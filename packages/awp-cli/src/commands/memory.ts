import { readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import Fuse from "fuse.js";
import { AWP_VERSION, MEMORY_DIR } from "@agent-workspace/core";
import { findWorkspaceRoot } from "../lib/workspace.js";
import { parseWorkspaceFile, writeWorkspaceFile } from "../lib/frontmatter.js";
import type { MemoryDailyFrontmatter, MemoryEntry } from "@agent-workspace/core";

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function currentTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

export async function memoryLogCommand(message: string, options: { tags?: string }): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  const memDir = join(root, MEMORY_DIR);
  await mkdir(memDir, { recursive: true });

  const date = todayDate();
  const filePath = join(memDir, `${date}.md`);
  const tags = options.tags ? options.tags.split(",").map((t) => t.trim()) : [];

  const entry: MemoryEntry = {
    time: currentTime(),
    content: message,
    tags: tags.length ? tags : undefined,
  };

  let file: { frontmatter: MemoryDailyFrontmatter; body: string; filePath: string };

  try {
    file = await parseWorkspaceFile<MemoryDailyFrontmatter>(filePath);
    if (!file.frontmatter.entries) {
      file.frontmatter.entries = [];
    }
    file.frontmatter.entries.push(entry);
  } catch {
    // File doesn't exist — create it
    file = {
      frontmatter: {
        awp: AWP_VERSION,
        type: "memory-daily",
        date,
        entries: [entry],
      },
      body: `\n# ${date}\n\n`,
      filePath,
    };
  }

  // Also append to markdown body
  const tagStr = tags.length ? ` [${tags.join(", ")}]` : "";
  file.body += `- **${entry.time}** — ${message}${tagStr}\n`;

  await writeWorkspaceFile(file);
  console.log(`Logged to memory/${date}.md at ${entry.time}`);
}

/** Search options for memory search */
export interface MemorySearchOptions {
  from?: string;
  to?: string;
  tag?: string;
  fuzzy?: boolean;
  limit?: string;
}

/** Entry with date context for display */
interface SearchableEntry {
  date: string;
  time?: string;
  content: string;
  tags?: string[];
}

/**
 * Search memory entries with optional fuzzy matching and date filtering.
 */
export async function memorySearchCommand(
  query: string,
  options: MemorySearchOptions = {}
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  const memDir = join(root, MEMORY_DIR);
  const { from, to, tag, fuzzy = false, limit } = options;
  const maxResults = limit ? parseInt(limit, 10) : undefined;

  let files: string[];
  try {
    files = await readdir(memDir);
  } catch {
    console.log("No memory directory found.");
    return;
  }

  // Filter files by date range (filenames are YYYY-MM-DD.md)
  let mdFiles = files
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  if (from) {
    mdFiles = mdFiles.filter((f) => f.replace(".md", "") >= from);
  }
  if (to) {
    mdFiles = mdFiles.filter((f) => f.replace(".md", "") <= to);
  }

  // Collect all entries
  const allEntries: SearchableEntry[] = [];

  for (const f of mdFiles) {
    try {
      const parsed = await parseWorkspaceFile<MemoryDailyFrontmatter>(join(memDir, f));
      const entries = parsed.frontmatter.entries || [];
      const date = parsed.frontmatter.date;

      for (const e of entries) {
        // Filter by tag if specified
        if (tag && (!e.tags || !e.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase())))) {
          continue;
        }
        allEntries.push({
          date,
          time: e.time,
          content: e.content,
          tags: e.tags,
        });
      }
    } catch {
      // Skip unparseable files
    }
  }

  if (allEntries.length === 0) {
    console.log("No memory entries found matching filters.");
    return;
  }

  // Search using Fuse.js for fuzzy matching, or simple includes for exact
  let results: SearchableEntry[];

  if (fuzzy) {
    const fuse = new Fuse(allEntries, {
      keys: ["content", "tags"],
      threshold: 0.4, // 0 = exact, 1 = match anything
      includeScore: true,
    });
    const fuseResults = fuse.search(query);
    results = fuseResults.map((r) => r.item);
  } else {
    const queryLower = query.toLowerCase();
    results = allEntries.filter(
      (e) =>
        e.content.toLowerCase().includes(queryLower) ||
        (e.tags && e.tags.some((t) => t.toLowerCase().includes(queryLower)))
    );
  }

  // Apply limit
  if (maxResults && results.length > maxResults) {
    results = results.slice(0, maxResults);
  }

  if (results.length === 0) {
    console.log(`No memory entries matching "${query}".`);
    return;
  }

  // Group by date for display
  const byDate = new Map<string, SearchableEntry[]>();
  for (const r of results) {
    const existing = byDate.get(r.date) || [];
    existing.push(r);
    byDate.set(r.date, existing);
  }

  for (const [date, entries] of byDate) {
    console.log(`\n${date}:`);
    for (const e of entries) {
      const tagStr = e.tags?.length ? ` [${e.tags.join(", ")}]` : "";
      console.log(`  ${e.time || "??:??"} — ${e.content}${tagStr}`);
    }
  }

  console.log(`\n${results.length} matching entries found.`);
}
