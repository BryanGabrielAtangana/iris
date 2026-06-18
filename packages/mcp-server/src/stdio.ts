// SPDX-License-Identifier: Apache-2.0
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { IrisLibrary, readManifest, readManifestFile, resolveLoadout } from "@iris-sylvia/core";
import { resolveDefaultProvider } from "@iris-sylvia/embeddings";
import {
  createIrisMcpServer,
  type CreateServerOptions,
  type DiscoveryEvent,
  type ServerScope,
} from "./server.js";

/**
 * Discovery telemetry from the environment, for the wild-discovery A/B:
 *  - IRIS_LOG: append per-call JSONL events to this file.
 *  - IRIS_SESSION: session id stamped on every event (default: random).
 *  - IRIS_NO_AWARENESS=1: withhold the Tier-1 index from the tool description.
 */
function envTelemetry(): { awareness: boolean; onEvent?: (e: DiscoveryEvent) => void } {
  const awareness = process.env.IRIS_NO_AWARENESS !== "1";
  const logPath = process.env.IRIS_LOG;
  if (!logPath) return { awareness };
  const session = process.env.IRIS_SESSION ?? randomUUID();
  const onEvent = (e: DiscoveryEvent): void => {
    try {
      appendFileSync(logPath, JSON.stringify({ session, awareness, ...e }) + "\n");
    } catch {
      /* never let telemetry break the server */
    }
  };
  return { awareness, onEvent };
}

export interface StdioOptions extends CreateServerOptions {
  /** Library root directory. */
  root: string;
  /** Watch the library and hot-reload (default true). */
  watch?: boolean;
  /**
   * Path to an `iris.json` loadout manifest to scope discovery (Mode B). If
   * omitted, an `iris.json` in the library root is auto-detected.
   */
  manifestPath?: string;
}

/**
 * Start the Iris MCP server over stdio. Loads the library, optionally scopes it
 * to a loadout manifest, wires hot-reload to MCP list-changed notifications, and
 * connects.
 *
 * Returns the stop function plus a `scope` describing whether a loadout was
 * applied (for diagnostics).
 */
export async function startStdioServer(
  opts: StdioOptions,
): Promise<{
  stop: () => Promise<void>;
  scope?: ServerScope;
  scopeErrors?: string[];
  provider: string;
}> {
  // Semantic embeddings by default; falls back to the lexical engine offline.
  const provider = await resolveDefaultProvider({
    onFallback: (reason) => process.stderr.write(`[iris] ${reason}\n`),
  });
  const lib = new IrisLibrary({ root: opts.root, provider });
  await lib.load();

  // Resolve a loadout if one is provided or present in the library root.
  let scope = opts.scope;
  let scopeErrors: string[] | undefined;
  if (!scope) {
    const manifest = opts.manifestPath
      ? await readManifestFile(opts.manifestPath)
      : await readManifest(opts.root);
    if (manifest) {
      const resolved = await resolveLoadout(manifest, lib.skills(), opts.root);
      scope = { ids: resolved.ids, allowBroaden: resolved.allowBroaden };
      scopeErrors = resolved.errors.map((e) => `${e.id}: ${e.reason}`);
    }
  }

  const { server, refresh } = createIrisMcpServer(lib, { ...opts, scope, ...envTelemetry() });

  let unwatch: (() => void) | undefined;
  if (opts.watch ?? true) {
    unwatch = lib.watch(() => {
      refresh();
      server.sendToolListChanged();
      server.sendResourceListChanged();
      server.sendPromptListChanged();
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const stop = async (): Promise<void> => {
    unwatch?.();
    await server.close();
  };
  return { stop, scope, scopeErrors, provider: provider.name };
}
