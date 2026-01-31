/**
 * Git remote transport.
 *
 * Uses a temporary shallow clone to access a remote Git repository
 * containing an AWP workspace. Writes are committed and pushed back.
 *
 * Requires `simple-git` package.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit } from "simple-git";
import type {
  SyncTransport,
  SyncRemote,
  RemoteWorkspaceInfo,
  RemoteArtifactManifest,
  ArtifactFilter,
  ExportedSignalBatch,
} from "../types.js";
import { LocalFsTransport } from "./local-fs.js";

export class GitRemoteTransport implements SyncTransport {
  private tmpDir = "";
  private branch = "main";
  private gitUrl = "";
  /** Delegate to LocalFsTransport for actual file reads after cloning */
  private localTransport = new LocalFsTransport();

  async connect(remote: SyncRemote): Promise<RemoteWorkspaceInfo> {
    this.gitUrl = remote.url;
    this.branch = remote.branch || "main";

    // Create temp directory for shallow clone
    this.tmpDir = await mkdtemp(join(tmpdir(), "awp-sync-"));

    // Shallow clone
    const git = simpleGit();
    await git.clone(this.gitUrl, this.tmpDir, [
      "--depth",
      "1",
      "--single-branch",
      "--branch",
      this.branch,
    ]);

    // Connect local transport to the cloned workspace
    return this.localTransport.connect({
      ...remote,
      url: this.tmpDir,
      transport: "local-fs",
    });
  }

  async listArtifacts(filter?: ArtifactFilter): Promise<RemoteArtifactManifest[]> {
    return this.localTransport.listArtifacts(filter);
  }

  async readArtifact(
    slug: string
  ): Promise<{ frontmatter: Record<string, unknown>; content: string; raw: string }> {
    return this.localTransport.readArtifact(slug);
  }

  async writeArtifact(slug: string, content: string): Promise<void> {
    // Write to clone
    await this.localTransport.writeArtifact(slug, content);

    // Commit and push
    const git = simpleGit(this.tmpDir);
    await git.add(`artifacts/${slug}.md`);
    await git.commit(`sync: update artifact ${slug}`);
    await git.push("origin", this.branch);
  }

  async readSignalsSince(since: string): Promise<ExportedSignalBatch> {
    return this.localTransport.readSignalsSince(since);
  }

  async writeSignals(_batch: ExportedSignalBatch): Promise<void> {
    throw new Error(
      "Use importSignals() from operations/signal-sync.ts to import signals into a workspace"
    );
  }

  async disconnect(): Promise<void> {
    await this.localTransport.disconnect();
    if (this.tmpDir) {
      await rm(this.tmpDir, { recursive: true, force: true });
      this.tmpDir = "";
    }
  }
}
