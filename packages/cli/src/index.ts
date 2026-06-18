#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { buildProgram } from "./program.js";

// This module is the `iris` binary entrypoint and always runs. It must not be
// imported by other code — tests import `buildProgram` from "./program.js"
// directly. (A previous `import.meta.url === argv[1]` guard silently no-op'd
// when the bin was invoked through the npm `.bin/iris` symlink, because argv[1]
// is the symlink path, not the resolved module path.)
async function main(): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  process.stderr.write(`iris: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
