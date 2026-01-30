import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
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

export async function memoryLogCommand(
  message: string,
  options: { tags?: string }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  const memDir = join(root, MEMORY_DIR);
  await mkdir(memDir, { recursive: true });

  const date = todayDate();
  const filePath = join(memDir, `${date}.md`);
  const tags = options.tags
    ? options.tags.split(",").map((t) => t.trim())
    : [];

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

export async function memorySearchCommand(query: string): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  const memDir = join(root, MEMORY_DIR);
  const queryLower = query.toLowerCase();

  let files: string[];
  try {
    files = await readdir(memDir);
  } catch {
    console.log("No memory directory found.");
    return;
  }

  const mdFiles = files.filter((f) => f.endsWith(".md")).sort().reverse();
  let found = 0;

  for (const f of mdFiles) {
    try {
      const parsed = await parseWorkspaceFile<MemoryDailyFrontmatter>(
        join(memDir, f)
      );
      const entries = parsed.frontmatter.entries || [];
      const matches = entries.filter(
        (e) =>
          e.content.toLowerCase().includes(queryLower) ||
          (e.tags && e.tags.some((t) => t.toLowerCase().includes(queryLower)))
      );

      if (matches.length > 0) {
        console.log(`\n${parsed.frontmatter.date}:`);
        for (const m of matches) {
          const tagStr = m.tags?.length ? ` [${m.tags.join(", ")}]` : "";
          console.log(`  ${m.time || "??:??"} — ${m.content}${tagStr}`);
        }
        found += matches.length;
      }
    } catch {
      // Skip unparseable files
    }
  }

  if (found === 0) {
    console.log(`No memory entries matching "${query}".`);
  } else {
    console.log(`\n${found} matching entries found.`);
  }
}
