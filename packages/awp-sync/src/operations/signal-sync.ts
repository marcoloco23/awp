/**
 * Reputation signal sync operations.
 *
 * Exports signals from local reputation profiles and imports
 * signals from remote workspaces with deduplication.
 */

import { readFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { REPUTATION_DIR, MANIFEST_PATH } from "@agent-workspace/core";
import { atomicWriteFile, withFileLock, loadJsonFile, updateDimension } from "@agent-workspace/utils";
import type { ReputationDimension } from "@agent-workspace/core";
import type { ExportedSignalBatch, ExportedSignal } from "../types.js";

/**
 * Export reputation signals from a workspace since a given timestamp.
 */
export async function exportSignals(
  workspace: string,
  since: string
): Promise<ExportedSignalBatch> {
  const repDir = join(workspace, REPUTATION_DIR);
  const sinceDate = new Date(since);
  const signals: ExportedSignal[] = [];

  // Read workspace manifest for source info
  const manifestPath = join(workspace, MANIFEST_PATH);
  const manifest = await loadJsonFile<Record<string, unknown>>(manifestPath);
  const agentInfo = manifest?.agent as Record<string, string> | undefined;

  let files: string[];
  try {
    files = await readdir(repDir);
  } catch {
    return {
      sourceWorkspace: (manifest?.name as string) || "unknown",
      sourceAgentDid: agentInfo?.did || "unknown",
      exportedAt: new Date().toISOString(),
      signals: [],
    };
  }

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    try {
      const raw = await readFile(join(repDir, file), "utf-8");
      const { data } = matter(raw);

      const profileSignals = (data.signals as Array<Record<string, unknown>>) || [];
      const subjectDid = data.agentDid as string;
      const subjectName = data.agentName as string;

      for (const sig of profileSignals) {
        const sigTimestamp = new Date(sig.timestamp as string);
        if (sigTimestamp > sinceDate) {
          signals.push({
            subjectDid,
            subjectName,
            signal: {
              source: sig.source as string,
              dimension: sig.dimension as string,
              domain: sig.domain as string | undefined,
              score: sig.score as number,
              timestamp: sig.timestamp as string,
              evidence: sig.evidence as string | undefined,
              message: sig.message as string | undefined,
            },
          });
        }
      }
    } catch {
      // Skip unparseable profiles
    }
  }

  return {
    sourceWorkspace: (manifest?.name as string) || "unknown",
    sourceAgentDid: agentInfo?.did || "unknown",
    exportedAt: new Date().toISOString(),
    signals,
  };
}

/**
 * Import reputation signals into a workspace.
 *
 * For each signal:
 * 1. Find or create the reputation profile for the subject agent
 * 2. Deduplicate by (source, dimension, timestamp)
 * 3. Append new signals
 * 4. Recalculate dimension scores via EWMA
 */
export async function importSignals(
  workspace: string,
  batch: ExportedSignalBatch
): Promise<number> {
  const repDir = join(workspace, REPUTATION_DIR);
  await mkdir(repDir, { recursive: true });

  // Group signals by subject DID
  const bySubject = new Map<string, ExportedSignal[]>();
  for (const exported of batch.signals) {
    const key = exported.subjectDid;
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key)!.push(exported);
  }

  let totalImported = 0;

  for (const [subjectDid, signals] of bySubject) {
    // Find existing profile by scanning reputation dir for matching agentDid
    const profilePath = await findProfileByDid(repDir, subjectDid);

    if (profilePath) {
      // Update existing profile
      const imported = await updateExistingProfile(profilePath, signals);
      totalImported += imported;
    } else {
      // Create new profile from first signal's subject info
      const firstSignal = signals[0];
      const slug = subjectDid.replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      const newPath = join(repDir, `${slug}.md`);
      const imported = await createProfileWithSignals(newPath, firstSignal, signals);
      totalImported += imported;
    }
  }

  return totalImported;
}

/** Find a reputation profile file by agent DID */
async function findProfileByDid(repDir: string, agentDid: string): Promise<string | null> {
  let files: string[];
  try {
    files = await readdir(repDir);
  } catch {
    return null;
  }

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    try {
      const raw = await readFile(join(repDir, file), "utf-8");
      const { data } = matter(raw);
      if (data.agentDid === agentDid) {
        return join(repDir, file);
      }
    } catch {
      continue;
    }
  }

  return null;
}

/** Update an existing reputation profile with new signals (deduplicated) */
async function updateExistingProfile(
  profilePath: string,
  signals: ExportedSignal[]
): Promise<number> {
  let imported = 0;

  await withFileLock(profilePath, async () => {
    const raw = await readFile(profilePath, "utf-8");
    const { data, content } = matter(raw);

    const existingSignals = (data.signals as Array<Record<string, unknown>>) || [];
    const existingKeys = new Set(
      existingSignals.map(
        (s) => `${s.source}:${s.dimension}:${s.timestamp}`
      )
    );

    if (!data.dimensions) data.dimensions = {};

    for (const exported of signals) {
      const key = `${exported.signal.source}:${exported.signal.dimension}:${exported.signal.timestamp}`;
      if (existingKeys.has(key)) continue; // Deduplicate

      // Append signal
      existingSignals.push({
        source: exported.signal.source,
        dimension: exported.signal.dimension,
        domain: exported.signal.domain,
        score: exported.signal.score,
        timestamp: exported.signal.timestamp,
        evidence: exported.signal.evidence,
        message: exported.signal.message,
      });

      // Update dimension score via EWMA
      const dim = exported.signal.dimension;
      if (dim !== "domain-competence") {
        (data.dimensions as Record<string, unknown>)[dim] = updateDimension(
          (data.dimensions as Record<string, ReputationDimension | undefined>)[dim],
          exported.signal.score,
          new Date(exported.signal.timestamp)
        );
      }

      imported++;
    }

    data.signals = existingSignals;
    data.lastUpdated = new Date().toISOString();

    const output = matter.stringify(content, data);
    await atomicWriteFile(profilePath, output);
  });

  return imported;
}

/** Create a new reputation profile with initial signals */
async function createProfileWithSignals(
  profilePath: string,
  firstSignal: ExportedSignal,
  signals: ExportedSignal[]
): Promise<number> {
  const now = new Date().toISOString();
  const data: Record<string, unknown> = {
    awp: "0.4.0",
    rdp: "1.0",
    type: "reputation-profile",
    id: `reputation:${firstSignal.subjectDid.replace(/[^a-z0-9]/g, "-")}`,
    agentDid: firstSignal.subjectDid,
    agentName: firstSignal.subjectName,
    lastUpdated: now,
    dimensions: {},
    signals: [],
  };

  let imported = 0;

  for (const exported of signals) {
    (data.signals as unknown[]).push({
      source: exported.signal.source,
      dimension: exported.signal.dimension,
      domain: exported.signal.domain,
      score: exported.signal.score,
      timestamp: exported.signal.timestamp,
      evidence: exported.signal.evidence,
      message: exported.signal.message,
    });

    const dim = exported.signal.dimension;
    if (dim !== "domain-competence") {
      (data.dimensions as Record<string, unknown>)[dim] = updateDimension(
        (data.dimensions as Record<string, ReputationDimension | undefined>)[dim],
        exported.signal.score,
        new Date(exported.signal.timestamp)
      );
    }

    imported++;
  }

  const content = `\n# Reputation Profile: ${firstSignal.subjectName}\n\nSynced reputation profile.\n`;
  const output = matter.stringify(content, data);
  await atomicWriteFile(profilePath, output);

  return imported;
}
