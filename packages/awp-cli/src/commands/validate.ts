import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  REQUIRED_FILES,
  ALL_WORKSPACE_FILES,
  ARTIFACTS_DIR,
  REPUTATION_DIR,
  CONTRACTS_DIR,
  PROJECTS_DIR,
} from "@agent-workspace/core";
import { loadManifest } from "../lib/workspace.js";
import { requireWorkspaceRoot } from "../lib/cli-utils.js";
import { parseWorkspaceFile } from "../lib/frontmatter.js";
import { validateFrontmatter, validateManifest } from "../lib/schema.js";

/**
 * Scan a directory for .md files and validate each against its schema.
 * Returns the number of errors found.
 */
async function validateDirectory(
  root: string,
  relativeDir: string,
  _label: string
): Promise<{ errors: number; checked: number }> {
  const dir = join(root, relativeDir);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    // Directory doesn't exist — nothing to validate
    return { errors: 0, checked: 0 };
  }

  const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
  let errors = 0;
  let checked = 0;

  for (const f of mdFiles) {
    const relPath = `${relativeDir}/${f}`;
    try {
      const parsed = await parseWorkspaceFile(join(dir, f));
      const fm = parsed.frontmatter;

      if (!fm.awp || !fm.type) {
        console.log(`  [SKIP] ${relPath} — no AWP frontmatter`);
        continue;
      }

      checked++;
      const result = await validateFrontmatter(fm.type, fm as unknown as Record<string, unknown>);
      if (result.valid) {
        console.log(`  [PASS] ${relPath}`);
      } else {
        console.log(`  [FAIL] ${relPath}`);
        result.errors.forEach((e) => console.log(`         ${e}`));
        errors++;
      }
    } catch {
      // Unparseable file — skip
    }
  }

  return { errors, checked };
}

/**
 * Scan nested task directories under projects/.
 * Structure: projects/<slug>/tasks/<task>.md
 */
async function validateProjectTasks(root: string): Promise<{ errors: number; checked: number }> {
  const projectsDir = join(root, PROJECTS_DIR);
  let projectDirs: string[];
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    projectDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    // Projects directory doesn't exist — no tasks to validate
    return { errors: 0, checked: 0 };
  }

  let totalErrors = 0;
  let totalChecked = 0;

  for (const pDir of projectDirs) {
    const tasksRel = `${PROJECTS_DIR}/${pDir}/tasks`;
    const result = await validateDirectory(root, tasksRel, "task");
    totalErrors += result.errors;
    totalChecked += result.checked;
  }

  return { errors: totalErrors, checked: totalChecked };
}

export async function validateCommand(options?: { quick?: boolean }): Promise<void> {
  const root = await requireWorkspaceRoot();

  console.log(`Validating workspace at ${root}...\n`);
  let hasErrors = false;

  // 1. Validate manifest
  try {
    const manifest = await loadManifest(root);
    const result = await validateManifest(manifest as unknown as Record<string, unknown>);
    if (result.valid) {
      console.log("  [PASS] .awp/workspace.json");
    } else {
      console.log("  [FAIL] .awp/workspace.json");
      result.errors.forEach((e) => console.log(`         ${e}`));
      hasErrors = true;
    }
  } catch (err) {
    console.log(`  [FAIL] .awp/workspace.json — ${err}`);
    hasErrors = true;
  }

  // 2. Validate required files
  for (const file of REQUIRED_FILES) {
    const path = join(root, file);
    try {
      const parsed = await parseWorkspaceFile(path);
      const fm = parsed.frontmatter;

      if (!fm.awp) {
        console.log(`  [FAIL] ${file} — missing 'awp' field in frontmatter`);
        hasErrors = true;
        continue;
      }
      if (!fm.type) {
        console.log(`  [FAIL] ${file} — missing 'type' field in frontmatter`);
        hasErrors = true;
        continue;
      }

      const result = await validateFrontmatter(fm.type, fm as unknown as Record<string, unknown>);
      if (result.valid) {
        console.log(`  [PASS] ${file}`);
      } else {
        console.log(`  [FAIL] ${file}`);
        result.errors.forEach((e) => console.log(`         ${e}`));
        hasErrors = true;
      }
    } catch {
      console.log(`  [FAIL] ${file} — file not found or unreadable`);
      hasErrors = true;
    }
  }

  // 3. Validate optional files (if they exist)
  for (const file of ALL_WORKSPACE_FILES) {
    if ((REQUIRED_FILES as readonly string[]).includes(file)) continue;
    const path = join(root, file);
    try {
      const parsed = await parseWorkspaceFile(path);
      const fm = parsed.frontmatter;

      if (fm.awp && fm.type) {
        const result = await validateFrontmatter(fm.type, fm as unknown as Record<string, unknown>);
        if (result.valid) {
          console.log(`  [PASS] ${file}`);
        } else {
          console.log(`  [WARN] ${file}`);
          result.errors.forEach((e) => console.log(`         ${e}`));
        }
      } else {
        console.log(`  [SKIP] ${file} — no AWP frontmatter`);
      }
    } catch {
      // Optional file doesn't exist — fine
    }
  }

  // 4. Scan content directories (unless --quick)
  if (!options?.quick) {
    // Artifacts
    const artResult = await validateDirectory(root, ARTIFACTS_DIR, "artifact");
    if (artResult.errors > 0) hasErrors = true;

    // Reputation profiles
    const repResult = await validateDirectory(root, REPUTATION_DIR, "reputation");
    if (repResult.errors > 0) hasErrors = true;

    // Contracts
    const conResult = await validateDirectory(root, CONTRACTS_DIR, "contract");
    if (conResult.errors > 0) hasErrors = true;

    // Projects
    const projResult = await validateDirectory(root, PROJECTS_DIR, "project");
    if (projResult.errors > 0) hasErrors = true;

    // Tasks (nested under project dirs)
    const taskResult = await validateProjectTasks(root);
    if (taskResult.errors > 0) hasErrors = true;

    const totalScanned =
      artResult.checked +
      repResult.checked +
      conResult.checked +
      projResult.checked +
      taskResult.checked;
    if (totalScanned > 0) {
      console.log(`\n  Scanned ${totalScanned} content file(s).`);
    }
  }

  console.log("");
  if (hasErrors) {
    console.log("Validation FAILED. Fix the errors above.");
    process.exit(1);
  } else {
    console.log("Validation PASSED.");
  }
}
