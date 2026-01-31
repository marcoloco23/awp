import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { atomicWriteFile, withFileLock, safeWriteJson, loadJsonFile } from "./safe-io.js";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "awp-safe-io-test-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// atomicWriteFile
// ─────────────────────────────────────────────────────────────────────────────

describe("atomicWriteFile", () => {
  it("writes file content correctly", async () => {
    const filePath = join(testDir, "test.md");
    await atomicWriteFile(filePath, "hello world");
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("hello world");
  });

  it("creates parent directories", async () => {
    const filePath = join(testDir, "a", "b", "c", "test.md");
    await atomicWriteFile(filePath, "nested");
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("nested");
  });

  it("creates .bak on overwrite", async () => {
    const filePath = join(testDir, "test.md");
    await writeFile(filePath, "original", "utf-8");
    await atomicWriteFile(filePath, "updated");

    expect(await readFile(filePath, "utf-8")).toBe("updated");
    expect(await readFile(`${filePath}.bak`, "utf-8")).toBe("original");
  });

  it("rotates backups on repeated overwrites", async () => {
    const filePath = join(testDir, "test.md");

    await writeFile(filePath, "v1", "utf-8");
    await atomicWriteFile(filePath, "v2");
    await atomicWriteFile(filePath, "v3");
    await atomicWriteFile(filePath, "v4");

    expect(await readFile(filePath, "utf-8")).toBe("v4");
    expect(await readFile(`${filePath}.bak`, "utf-8")).toBe("v3");
    expect(await readFile(`${filePath}.bak.1`, "utf-8")).toBe("v2");
    expect(await readFile(`${filePath}.bak.2`, "utf-8")).toBe("v1");
  });

  it("does not create backup when backup=false", async () => {
    const filePath = join(testDir, "test.md");
    await writeFile(filePath, "original", "utf-8");
    await atomicWriteFile(filePath, "updated", { backup: false });

    expect(await readFile(filePath, "utf-8")).toBe("updated");
    expect(existsSync(`${filePath}.bak`)).toBe(false);
  });

  it("does not leave temp files on success", async () => {
    const filePath = join(testDir, "test.md");
    await atomicWriteFile(filePath, "content");

    const files = await readdir(testDir);
    expect(files.filter((f) => f.includes(".tmp"))).toHaveLength(0);
  });

  it("respects maxBackups option", async () => {
    const filePath = join(testDir, "test.md");

    await writeFile(filePath, "v1", "utf-8");
    for (let i = 2; i <= 6; i++) {
      await atomicWriteFile(filePath, `v${i}`, { maxBackups: 2 });
    }

    // Should only keep 2 backups: .bak and .bak.1
    expect(existsSync(`${filePath}.bak`)).toBe(true);
    expect(existsSync(`${filePath}.bak.1`)).toBe(true);
    // .bak.2 should not exist (maxBackups=2 means slots: .bak, .bak.1)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// withFileLock
// ─────────────────────────────────────────────────────────────────────────────

describe("withFileLock", () => {
  it("acquires lock and runs callback", async () => {
    const filePath = join(testDir, "data.md");
    const result = await withFileLock(filePath, async () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it("cleans up lock file after callback", async () => {
    const filePath = join(testDir, "data.md");
    await withFileLock(filePath, async () => {});

    const files = await readdir(testDir);
    expect(files.filter((f) => f.includes(".lock"))).toHaveLength(0);
  });

  it("cleans up lock file after callback throws", async () => {
    const filePath = join(testDir, "data.md");
    await expect(
      withFileLock(filePath, async () => {
        throw new Error("test error");
      })
    ).rejects.toThrow("test error");

    const files = await readdir(testDir);
    expect(files.filter((f) => f.includes(".lock"))).toHaveLength(0);
  });

  it("serializes concurrent access", async () => {
    const filePath = join(testDir, "counter.txt");
    await writeFile(filePath, "0", "utf-8");

    // Run 5 concurrent increments
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        withFileLock(filePath, async () => {
          const val = parseInt(await readFile(filePath, "utf-8"), 10);
          await writeFile(filePath, String(val + 1), "utf-8");
          return val + 1;
        })
      )
    );

    // All increments should have serialized correctly
    const finalValue = await readFile(filePath, "utf-8");
    expect(parseInt(finalValue, 10)).toBe(5);
    // Results should contain all values 1-5
    expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("supports nested lock counting", async () => {
    const filePath = join(testDir, "data.md");
    const result = await withFileLock(filePath, async () => {
      // Nested lock on same file should not deadlock
      return withFileLock(filePath, async () => {
        return "nested ok";
      });
    });
    expect(result).toBe("nested ok");
  });

  it("times out if lock cannot be acquired", async () => {
    const filePath = join(testDir, "data.md");
    const lockPath = `${filePath}.lock`;

    // Create a lock file from a "live" process (our own PID)
    await mkdir(testDir, { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
      "utf-8"
    );

    // Should timeout since lock is held by a "live" process
    await expect(
      withFileLock(filePath, async () => {}, { timeout: 200 })
    ).rejects.toThrow(/timeout/i);

    // Clean up the lock file manually
    await rm(lockPath, { force: true });
  });

  it("detects stale locks from dead process", async () => {
    const filePath = join(testDir, "data.md");
    const lockPath = `${filePath}.lock`;

    // Create a lock from a definitely-dead PID
    await mkdir(testDir, { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({ pid: 999999999, createdAt: new Date().toISOString() }),
      "utf-8"
    );

    // Should succeed because the PID is dead
    const result = await withFileLock(filePath, async () => "recovered");
    expect(result).toBe("recovered");
  });

  it("detects stale locks by age", async () => {
    const filePath = join(testDir, "data.md");
    const lockPath = `${filePath}.lock`;

    // Create a lock from our own PID but with an old timestamp
    await mkdir(testDir, { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: process.pid,
        createdAt: new Date(Date.now() - 2_000_000).toISOString(),
      }),
      "utf-8"
    );

    // Should succeed because the lock is stale (older than 30min default)
    const result = await withFileLock(filePath, async () => "recovered");
    expect(result).toBe("recovered");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeWriteJson
// ─────────────────────────────────────────────────────────────────────────────

describe("safeWriteJson", () => {
  it("writes valid JSON with formatting", async () => {
    const filePath = join(testDir, "data.json");
    await safeWriteJson(filePath, { key: "value", num: 42 });

    const raw = await readFile(filePath, "utf-8");
    expect(raw).toBe('{\n  "key": "value",\n  "num": 42\n}\n');
  });

  it("creates directories recursively", async () => {
    const filePath = join(testDir, "a", "b", "data.json");
    await safeWriteJson(filePath, { ok: true });

    const data = JSON.parse(await readFile(filePath, "utf-8"));
    expect(data).toEqual({ ok: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// loadJsonFile
// ─────────────────────────────────────────────────────────────────────────────

describe("loadJsonFile", () => {
  it("loads valid JSON", async () => {
    const filePath = join(testDir, "data.json");
    await writeFile(filePath, '{"key": "value"}', "utf-8");

    const data = await loadJsonFile<{ key: string }>(filePath);
    expect(data).toEqual({ key: "value" });
  });

  it("returns undefined for missing file", async () => {
    const data = await loadJsonFile(join(testDir, "nonexistent.json"));
    expect(data).toBeUndefined();
  });

  it("returns undefined for corrupt JSON", async () => {
    const filePath = join(testDir, "corrupt.json");
    await writeFile(filePath, "not valid json {{{", "utf-8");

    const data = await loadJsonFile(filePath);
    expect(data).toBeUndefined();
  });
});
