/**
 * Transport factory.
 */

import type { SyncRemote, SyncTransport } from "../types.js";
import { LocalFsTransport } from "./local-fs.js";
import { GitRemoteTransport } from "./git-remote.js";

/**
 * Create a transport adapter for the given remote.
 */
export function createTransport(remote: SyncRemote): SyncTransport {
  switch (remote.transport) {
    case "local-fs":
      return new LocalFsTransport();
    case "git-remote":
      return new GitRemoteTransport();
    case "http":
      throw new Error("HTTP transport is not yet implemented (planned for v1.0)");
    default:
      throw new Error(`Unknown transport type: ${remote.transport}`);
  }
}
