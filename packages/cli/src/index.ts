#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { buildProgram } from "./program.js";

export { buildProgram } from "./program.js";

async function main(): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

// Only auto-run when invoked as a binary, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`iris: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
