#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { resolve } from "node:path";
import { startStdioServer } from "./stdio.js";

/**
 * `iris-mcp` — launch the Iris MCP server over stdio.
 *
 * Usage: iris-mcp [libraryRoot]
 *   IRIS_LIBRARY env var is used when no path is given; defaults to cwd.
 *   IRIS_NO_EXEC=1 disables script execution.
 */
async function main(): Promise<void> {
  const arg = process.argv[2];
  const root = resolve(arg ?? process.env.IRIS_LIBRARY ?? process.cwd());
  const allowExec = process.env.IRIS_NO_EXEC !== "1";

  const stop = await startStdioServer({ root, allowExec });
  // Tools communicate over stdout/stdin; keep diagnostics on stderr only.
  process.stderr.write(`[iris] MCP server started for library: ${root}\n`);

  const shutdown = async (): Promise<void> => {
    await stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  process.stderr.write(`[iris] fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
