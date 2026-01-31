/**
 * Manifesto CLI commands.
 *
 * Commands for validating, viewing, and comparing manifestos.
 */

import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";

/** Required fields in a manifesto */
const REQUIRED_FIELDS = [
  "exp",
  "type",
  "id",
  "name",
  "version",
  "values",
  "fitness",
  "constraints",
];

/**
 * Validate a manifesto file.
 *
 * awp manifesto validate <path>
 */
export async function manifestoValidateCommand(path: string): Promise<void> {
  const manifestoPath = resolve(path);

  try {
    const raw = await readFile(manifestoPath, "utf-8");
    const { data } = matter(raw);

    const errors: string[] = [];

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate type
    if (data.type && data.type !== "manifesto") {
      errors.push(`Invalid type: expected "manifesto", got "${data.type}"`);
    }

    // Validate id pattern
    if (data.id && typeof data.id === "string") {
      const idPattern = /^manifesto:[a-z0-9][a-z0-9-]*$/;
      if (!idPattern.test(data.id)) {
        errors.push(`Invalid id format: "${data.id}" (expected manifesto:<slug>)`);
      }
    }

    // Validate version pattern
    if (data.version && typeof data.version === "string") {
      const versionPattern = /^\d+\.\d+\.\d+$/;
      if (!versionPattern.test(data.version)) {
        errors.push(`Invalid version format: "${data.version}" (expected semver x.y.z)`);
      }
    }

    // Validate values sum to ~1.0
    if (data.values && typeof data.values === "object") {
      const valuesSum = Object.values(data.values as Record<string, number>).reduce(
        (a: number, b: number) => a + b,
        0
      );
      if (Math.abs(valuesSum - 1.0) > 0.01) {
        errors.push(`Values must sum to 1.0 (got ${valuesSum.toFixed(3)})`);
      }
    }

    // Validate fitness weights are between 0 and 1
    if (data.fitness && typeof data.fitness === "object") {
      for (const [key, value] of Object.entries(data.fitness as Record<string, number>)) {
        if (typeof value !== "number" || value < 0 || value > 1) {
          errors.push(`Invalid fitness weight "${key}": must be number between 0 and 1`);
        }
      }
    }

    // Validate constraints
    if (data.constraints && typeof data.constraints === "object") {
      const c = data.constraints as Record<string, unknown>;
      if (c.maxAgents !== undefined && (typeof c.maxAgents !== "number" || c.maxAgents < 1)) {
        errors.push("constraints.maxAgents must be a positive integer");
      }
      if (
        c.maxConcurrentTasks !== undefined &&
        (typeof c.maxConcurrentTasks !== "number" || c.maxConcurrentTasks < 1)
      ) {
        errors.push("constraints.maxConcurrentTasks must be a positive integer");
      }
    }

    // Output results
    if (errors.length === 0) {
      console.log(`✓ Manifesto is valid: ${manifestoPath}`);
      console.log(`  ID: ${data.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Version: ${data.version}`);
    } else {
      console.error(`✗ Manifesto validation failed: ${manifestoPath}`);
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error reading manifesto: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

/**
 * Show a manifesto's configuration.
 *
 * awp manifesto show <path>
 */
export async function manifestoShowCommand(path: string): Promise<void> {
  const manifestoPath = resolve(path);

  try {
    const raw = await readFile(manifestoPath, "utf-8");
    const { data, content } = matter(raw);

    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  MANIFESTO: ${data.name || "Untitled"}`);
    console.log("═══════════════════════════════════════════════════════════════");
    console.log();

    // Metadata
    console.log("┌─ Metadata ─────────────────────────────────────────────────────");
    console.log(`│  ID:       ${data.id || "N/A"}`);
    console.log(`│  Version:  ${data.version || "N/A"}`);
    console.log(`│  EXP:      ${data.exp || "N/A"}`);
    console.log("└────────────────────────────────────────────────────────────────");
    console.log();

    // Values
    if (data.values && typeof data.values === "object") {
      const values = data.values as Record<string, number>;
      console.log("┌─ Values ────────────────────────────────────────────────────────");
      for (const [key, weight] of Object.entries(values)) {
        const bar = "█".repeat(Math.round(weight * 20));
        const pad = " ".repeat(20 - Math.round(weight * 20));
        console.log(`│  ${key.padEnd(30)} ${bar}${pad} ${(weight * 100).toFixed(0)}%`);
      }
      console.log("└────────────────────────────────────────────────────────────────");
      console.log();
    }

    // Fitness
    if (data.fitness && typeof data.fitness === "object") {
      const fitness = data.fitness as Record<string, number>;
      console.log("┌─ Fitness Weights ───────────────────────────────────────────────");
      for (const [key, weight] of Object.entries(fitness)) {
        const bar = "█".repeat(Math.round(weight * 20));
        const pad = " ".repeat(20 - Math.round(weight * 20));
        console.log(`│  ${key.padEnd(30)} ${bar}${pad} ${(weight * 100).toFixed(0)}%`);
      }
      console.log("└────────────────────────────────────────────────────────────────");
      console.log();
    }

    // Constraints
    if (data.constraints && typeof data.constraints === "object") {
      const constraints = data.constraints as Record<string, unknown>;
      console.log("┌─ Constraints ───────────────────────────────────────────────────");
      for (const [key, value] of Object.entries(constraints)) {
        console.log(`│  ${key.padEnd(25)} ${value}`);
      }
      console.log("└────────────────────────────────────────────────────────────────");
      console.log();
    }

    // Governance
    if (data.governance && typeof data.governance === "object") {
      const gov = data.governance as Record<string, unknown>;
      console.log("┌─ Governance ────────────────────────────────────────────────────");
      if (gov.humanApprovalRequired && Array.isArray(gov.humanApprovalRequired)) {
        console.log(
          `│  Human Approval Required: ${gov.humanApprovalRequired.join(", ") || "none"}`
        );
      }
      if (gov.escalationThreshold !== undefined) {
        console.log(`│  Escalation Threshold:    ${gov.escalationThreshold}`);
      }
      if (gov.vetoPower !== undefined) {
        console.log(`│  Veto Power:              ${gov.vetoPower ? "yes" : "no"}`);
      }
      console.log("└────────────────────────────────────────────────────────────────");
      console.log();
    }

    // Anti-patterns
    if (data.antiPatterns && Array.isArray(data.antiPatterns) && data.antiPatterns.length > 0) {
      console.log("┌─ Anti-Patterns ─────────────────────────────────────────────────");
      for (const ap of data.antiPatterns as Array<{
        id: string;
        detector: string;
        penalty: number;
      }>) {
        console.log(`│  ${ap.id.padEnd(25)} penalty: ${ap.penalty}`);
        console.log(`│    └─ ${ap.detector}`);
      }
      console.log("└────────────────────────────────────────────────────────────────");
      console.log();
    }

    // Success Criteria
    if (
      data.successCriteria &&
      Array.isArray(data.successCriteria) &&
      data.successCriteria.length > 0
    ) {
      console.log("┌─ Success Criteria ──────────────────────────────────────────────");
      for (const sc of data.successCriteria as Array<{
        id: string;
        metric: string;
        threshold?: number;
        direction?: string;
      }>) {
        const threshold = sc.threshold !== undefined ? ` >= ${sc.threshold}` : "";
        const direction = sc.direction ? ` (${sc.direction})` : "";
        console.log(`│  ${sc.id.padEnd(30)} ${sc.metric}${threshold}${direction}`);
      }
      console.log("└────────────────────────────────────────────────────────────────");
      console.log();
    }

    // Content preview
    const trimmedContent = content.trim();
    if (trimmedContent) {
      const lines = trimmedContent.split("\n").slice(0, 5);
      console.log("┌─ Content Preview ───────────────────────────────────────────────");
      for (const line of lines) {
        console.log(`│  ${line}`);
      }
      if (trimmedContent.split("\n").length > 5) {
        console.log("│  ...");
      }
      console.log("└────────────────────────────────────────────────────────────────");
    }
  } catch (error) {
    console.error(`Error reading manifesto: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

/**
 * Compare two manifestos side-by-side.
 *
 * awp manifesto diff <path1> <path2>
 */
export async function manifestoDiffCommand(path1: string, path2: string): Promise<void> {
  const manifestoPath1 = resolve(path1);
  const manifestoPath2 = resolve(path2);

  try {
    const raw1 = await readFile(manifestoPath1, "utf-8");
    const raw2 = await readFile(manifestoPath2, "utf-8");
    const { data: data1 } = matter(raw1);
    const { data: data2 } = matter(raw2);

    const name1 = (data1.name as string) || "Manifesto A";
    const name2 = (data2.name as string) || "Manifesto B";

    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  COMPARING: ${name1} vs ${name2}`);
    console.log("═══════════════════════════════════════════════════════════════");
    console.log();

    let hasDifferences = false;

    // Compare metadata
    const metadataFields = ["id", "version", "exp"];
    const metaDiffs: string[] = [];
    for (const field of metadataFields) {
      if (data1[field] !== data2[field]) {
        metaDiffs.push(
          `  ${field.padEnd(15)} ${String(data1[field] || "N/A").padEnd(25)} ${data2[field] || "N/A"}`
        );
        hasDifferences = true;
      }
    }
    if (metaDiffs.length > 0) {
      console.log(
        `${"Field".padEnd(17)} ${name1.substring(0, 25).padEnd(25)} ${name2.substring(0, 25)}`
      );
      console.log(`${"-".repeat(17)} ${"-".repeat(25)} ${"-".repeat(25)}`);
      for (const diff of metaDiffs) {
        console.log(diff);
      }
      console.log();
    }

    // Compare values
    const values1 = (data1.values as Record<string, number>) || {};
    const values2 = (data2.values as Record<string, number>) || {};
    const allValueKeys = new Set([...Object.keys(values1), ...Object.keys(values2)]);
    const valueDiffs: string[] = [];

    for (const key of allValueKeys) {
      const v1 = values1[key];
      const v2 = values2[key];
      if (v1 !== v2) {
        const v1Str = v1 !== undefined ? `${(v1 * 100).toFixed(0)}%` : "-";
        const v2Str = v2 !== undefined ? `${(v2 * 100).toFixed(0)}%` : "-";
        const delta =
          v1 !== undefined && v2 !== undefined
            ? `${v2 > v1 ? "+" : ""}${((v2 - v1) * 100).toFixed(0)}%`
            : "N/A";
        valueDiffs.push(`  ${key.padEnd(25)} ${v1Str.padEnd(10)} ${v2Str.padEnd(10)} ${delta}`);
        hasDifferences = true;
      }
    }

    if (valueDiffs.length > 0) {
      console.log("┌─ Values Differences ────────────────────────────────────────────");
      console.log(`│  ${"Key".padEnd(25)} ${"A".padEnd(10)} ${"B".padEnd(10)} Delta`);
      console.log(`│  ${"-".repeat(25)} ${"-".repeat(10)} ${"-".repeat(10)} ${"-".repeat(10)}`);
      for (const diff of valueDiffs) {
        console.log(`│${diff}`);
      }
      console.log("└────────────────────────────────────────────────────────────────");
      console.log();
    }

    // Compare fitness
    const fitness1 = (data1.fitness as Record<string, number>) || {};
    const fitness2 = (data2.fitness as Record<string, number>) || {};
    const allFitnessKeys = new Set([...Object.keys(fitness1), ...Object.keys(fitness2)]);
    const fitnessDiffs: string[] = [];

    for (const key of allFitnessKeys) {
      const f1 = fitness1[key];
      const f2 = fitness2[key];
      if (f1 !== f2) {
        const f1Str = f1 !== undefined ? `${(f1 * 100).toFixed(0)}%` : "-";
        const f2Str = f2 !== undefined ? `${(f2 * 100).toFixed(0)}%` : "-";
        const delta =
          f1 !== undefined && f2 !== undefined
            ? `${f2 > f1 ? "+" : ""}${((f2 - f1) * 100).toFixed(0)}%`
            : "N/A";
        fitnessDiffs.push(`  ${key.padEnd(25)} ${f1Str.padEnd(10)} ${f2Str.padEnd(10)} ${delta}`);
        hasDifferences = true;
      }
    }

    if (fitnessDiffs.length > 0) {
      console.log("┌─ Fitness Differences ───────────────────────────────────────────");
      console.log(`│  ${"Key".padEnd(25)} ${"A".padEnd(10)} ${"B".padEnd(10)} Delta`);
      console.log(`│  ${"-".repeat(25)} ${"-".repeat(10)} ${"-".repeat(10)} ${"-".repeat(10)}`);
      for (const diff of fitnessDiffs) {
        console.log(`│${diff}`);
      }
      console.log("└────────────────────────────────────────────────────────────────");
      console.log();
    }

    // Compare constraints
    const constraints1 = (data1.constraints as Record<string, unknown>) || {};
    const constraints2 = (data2.constraints as Record<string, unknown>) || {};
    const allConstraintKeys = new Set([...Object.keys(constraints1), ...Object.keys(constraints2)]);
    const constraintDiffs: string[] = [];

    for (const key of allConstraintKeys) {
      const c1 = constraints1[key];
      const c2 = constraints2[key];
      if (c1 !== c2) {
        const c1Str = c1 !== undefined ? String(c1) : "-";
        const c2Str = c2 !== undefined ? String(c2) : "-";
        constraintDiffs.push(`  ${key.padEnd(25)} ${c1Str.padEnd(10)} ${c2Str.padEnd(10)}`);
        hasDifferences = true;
      }
    }

    if (constraintDiffs.length > 0) {
      console.log("┌─ Constraint Differences ────────────────────────────────────────");
      console.log(`│  ${"Key".padEnd(25)} ${"A".padEnd(10)} ${"B".padEnd(10)}`);
      console.log(`│  ${"-".repeat(25)} ${"-".repeat(10)} ${"-".repeat(10)}`);
      for (const diff of constraintDiffs) {
        console.log(`│${diff}`);
      }
      console.log("└────────────────────────────────────────────────────────────────");
      console.log();
    }

    // Summary
    if (!hasDifferences) {
      console.log("No differences found between the two manifestos.");
    } else {
      console.log("═══════════════════════════════════════════════════════════════");
    }
  } catch (error) {
    console.error(`Error comparing manifestos: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
