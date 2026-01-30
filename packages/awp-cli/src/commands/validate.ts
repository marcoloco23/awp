import { join } from "node:path";
import { REQUIRED_FILES, ALL_WORKSPACE_FILES } from "@agent-workspace/core";
import {
  findWorkspaceRoot,
  loadManifest,
} from "../lib/workspace.js";
import { parseWorkspaceFile } from "../lib/frontmatter.js";
import { validateFrontmatter, validateManifest } from "../lib/schema.js";

export async function validateCommand(): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error(
      "Error: Not in an AWP workspace. Run 'awp init' to create one."
    );
    process.exit(1);
  }

  console.log(`Validating workspace at ${root}...\n`);
  let hasErrors = false;

  // 1. Validate manifest
  try {
    const manifest = await loadManifest(root);
    const result = await validateManifest(
      manifest as unknown as Record<string, unknown>
    );
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

      const result = await validateFrontmatter(
        fm.type,
        fm as unknown as Record<string, unknown>
      );
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
        const result = await validateFrontmatter(
          fm.type,
          fm as unknown as Record<string, unknown>
        );
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

  console.log("");
  if (hasErrors) {
    console.log("Validation FAILED. Fix the errors above.");
    process.exit(1);
  } else {
    console.log("Validation PASSED.");
  }
}
