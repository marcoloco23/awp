/**
 * Safe file I/O utilities inspired by clawdbot.
 *
 * Provides atomic writes (temp file + rename), file locking with stale
 * detection, backup rotation, and safe JSON helpers.
 */

import { mkdir, writeFile, readFile, rename, copyFile, unlink, chmod, open, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, basename, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AtomicWriteOptions {
  /** Enable backup rotation on overwrite (default: true) */
  backup?: boolean;
  /** Maximum number of backup copies to keep (default: 5) */
  maxBackups?: number;
}

export interface FileLockOptions {
  /** Lock acquisition timeout in milliseconds (default: 10_000) */
  timeout?: number;
  /** Age in milliseconds after which a lock is considered stale (default: 1_800_000 = 30min) */
  staleThreshold?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-process lock tracking (prevents self-deadlock)
// ─────────────────────────────────────────────────────────────────────────────

interface LockEntry {
  count: number;
  lockPath: string;
}

const HELD_LOCKS = new Map<string, LockEntry>();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a process is still alive via signal 0.
 */
function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse lock file payload.
 */
async function readLockPayload(
  lockPath: string
): Promise<{ pid: number; createdAt: string } | null> {
  try {
    const raw = await readFile(lockPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.pid !== "number" || typeof parsed.createdAt !== "string") return null;
    return { pid: parsed.pid, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

/**
 * Rotate backup files: .bak → .bak.1, .bak.1 → .bak.2, etc.
 * Deletes the oldest backup if at max capacity.
 */
async function rotateBackups(filePath: string, maxBackups: number): Promise<void> {
  if (maxBackups <= 1) return;

  const backupBase = `${filePath}.bak`;
  const maxIndex = maxBackups - 1;

  // Delete oldest
  await unlink(`${backupBase}.${maxIndex}`).catch(() => {});

  // Shift all down
  for (let i = maxIndex - 1; i >= 1; i--) {
    await rename(`${backupBase}.${i}`, `${backupBase}.${i + 1}`).catch(() => {});
  }

  // Move current .bak to .bak.1
  await rename(backupBase, `${backupBase}.1`).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// atomicWriteFile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write a file atomically using temp file + rename.
 *
 * - Writes content to a uniquely-named temp file
 * - Backs up the existing file with rotation (if it exists)
 * - Atomically renames the temp file to the target
 * - Falls back to copyFile on cross-device or Windows errors
 * - Cleans up the temp file on failure
 */
export async function atomicWriteFile(
  filePath: string,
  content: string,
  options?: AtomicWriteOptions
): Promise<void> {
  const doBackup = options?.backup !== false;
  const maxBackups = options?.maxBackups ?? 5;

  const dir = dirname(filePath);
  const base = basename(filePath);
  const tmp = join(dir, `${base}.${process.pid}.${randomUUID()}.tmp`);

  // Ensure directory exists
  await mkdir(dir, { recursive: true });

  // Write to temp file
  await writeFile(tmp, content, { encoding: "utf-8" });

  try {
    // Backup existing file
    if (doBackup && existsSync(filePath)) {
      await rotateBackups(filePath, maxBackups);
      await copyFile(filePath, `${filePath}.bak`).catch(() => {});
    }

    // Atomic rename
    await rename(tmp, filePath);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;

    // Cross-device rename or Windows permission error: fall back to copy
    if (code === "EXDEV" || code === "EPERM" || code === "EEXIST") {
      await copyFile(tmp, filePath);
      await unlink(tmp).catch(() => {});
      return;
    }

    // Clean up temp file on unexpected error
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// withFileLock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a function while holding an exclusive file lock.
 *
 * - Uses `fs.open(lockPath, "wx")` for exclusive creation
 * - Supports nested lock counting (same process, same file)
 * - Detects stale locks via timestamp age and PID liveness
 * - Retries with exponential backoff up to timeout
 * - Always releases lock in finally block
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>,
  options?: FileLockOptions
): Promise<T> {
  const timeout = options?.timeout ?? 10_000;
  const staleThreshold = options?.staleThreshold ?? 30 * 60 * 1000;

  const normalizedPath = resolve(filePath);
  const lockPath = `${normalizedPath}.lock`;

  // Check for nested lock (same process already holds this lock)
  const held = HELD_LOCKS.get(normalizedPath);
  if (held) {
    held.count++;
    try {
      return await fn();
    } finally {
      held.count--;
      if (held.count <= 0) {
        HELD_LOCKS.delete(normalizedPath);
        await rm(held.lockPath, { force: true }).catch(() => {});
      }
    }
  }

  // Acquire new lock
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < timeout) {
    attempt++;

    try {
      // Ensure directory exists
      await mkdir(dirname(lockPath), { recursive: true });

      // Exclusive creation — fails with EEXIST if lock already held
      const handle = await open(lockPath, "wx");
      const payload = JSON.stringify(
        { pid: process.pid, createdAt: new Date().toISOString() },
        null,
        2
      );
      await handle.writeFile(payload, "utf-8");
      await handle.close();

      // Register in-process lock
      HELD_LOCKS.set(normalizedPath, { count: 1, lockPath });

      try {
        return await fn();
      } finally {
        const current = HELD_LOCKS.get(normalizedPath);
        if (current) {
          current.count--;
          if (current.count <= 0) {
            HELD_LOCKS.delete(normalizedPath);
            await rm(current.lockPath, { force: true }).catch(() => {});
          }
        }
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;

      // Lock file exists — check if stale
      const lockPayload = await readLockPayload(lockPath);
      if (lockPayload) {
        const createdAt = Date.parse(lockPayload.createdAt);
        const isStale =
          !Number.isFinite(createdAt) || Date.now() - createdAt > staleThreshold;
        const isAlive = isProcessAlive(lockPayload.pid);

        if (isStale || !isAlive) {
          // Remove stale lock and retry immediately
          await rm(lockPath, { force: true }).catch(() => {});
          continue;
        }
      } else {
        // Can't read lock file — remove and retry
        await rm(lockPath, { force: true }).catch(() => {});
        continue;
      }

      // Lock is held by a live process — wait with backoff
      const delay = Math.min(1000, 50 * attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // Timeout
  const lockPayload = await readLockPayload(lockPath);
  const owner = lockPayload?.pid ? `pid=${lockPayload.pid}` : "unknown";
  throw new Error(`File lock timeout (${timeout}ms): ${owner} holds ${lockPath}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// safeWriteJson
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write a JSON file atomically with directory creation.
 */
export async function safeWriteJson(
  filePath: string,
  data: unknown,
  options?: AtomicWriteOptions
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await atomicWriteFile(filePath, JSON.stringify(data, null, 2) + "\n", options);
}

// ─────────────────────────────────────────────────────────────────────────────
// loadJsonFile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load and parse a JSON file, returning undefined if missing or corrupt.
 */
export async function loadJsonFile<T = unknown>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || err instanceof SyntaxError) {
      return undefined;
    }
    throw err;
  }
}
