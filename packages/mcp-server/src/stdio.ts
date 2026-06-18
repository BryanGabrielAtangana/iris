// SPDX-License-Identifier: Apache-2.0
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { IrisLibrary } from "@iris-sylvia/core";
import { createIrisMcpServer, type CreateServerOptions } from "./server.js";

export interface StdioOptions extends CreateServerOptions {
  /** Library root directory. */
  root: string;
  /** Watch the library and hot-reload (default true). */
  watch?: boolean;
}

/**
 * Start the Iris MCP server over stdio. Loads the library, wires hot-reload to
 * MCP `tools/listChanged` + `resources/listChanged` notifications, and connects.
 */
export async function startStdioServer(opts: StdioOptions): Promise<() => Promise<void>> {
  const lib = new IrisLibrary({ root: opts.root });
  await lib.load();

  const { server, refresh } = createIrisMcpServer(lib, opts);

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

  return async () => {
    unwatch?.();
    await server.close();
  };
}
