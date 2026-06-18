// SPDX-License-Identifier: Apache-2.0
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { IrisLibrary, readManifest, readManifestFile, resolveLoadout } from "@iris-sylvia/core";
import { createIrisMcpServer, type CreateServerOptions, type ServerScope } from "./server.js";

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
): Promise<{ stop: () => Promise<void>; scope?: ServerScope; scopeErrors?: string[] }> {
  const lib = new IrisLibrary({ root: opts.root });
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

  const { server, refresh } = createIrisMcpServer(lib, { ...opts, scope });

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
  return { stop, scope, scopeErrors };
}
