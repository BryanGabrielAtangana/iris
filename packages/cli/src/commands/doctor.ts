// SPDX-License-Identifier: Apache-2.0
import { estimateTokens, TIER1_TOKEN_BUDGET } from "@iris/core";
import { loadLibrary, resolveLibraryRoot } from "../library.js";

export interface DoctorOptions {
  library?: string;
}

/** `iris doctor` — report environment + index health. */
export async function doctorCommand(opts: DoctorOptions): Promise<void> {
  const out = process.stdout;
  out.write("Iris doctor\n\n");

  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const nodeOk = nodeMajor >= 20;
  out.write(`  ${nodeOk ? "✓" : "✗"} Node ${process.versions.node} (need >= 20)\n`);

  const root = resolveLibraryRoot(opts.library);
  out.write(`  • Library root: ${root}\n`);

  const lib = await loadLibrary(root);
  const skills = lib.skills();
  out.write(`  ${skills.length > 0 ? "✓" : "•"} ${skills.length} skill(s) indexed\n`);

  const errors = lib.scanErrors();
  if (errors.length > 0) {
    out.write(`  ✗ ${errors.length} skill(s) failed to parse:\n`);
    for (const e of errors) out.write(`      - ${e.path}: ${e.error}\n`);
  } else {
    out.write(`  ✓ No parse errors\n`);
  }

  const index = lib.buildTier1Index();
  const tokens = estimateTokens(index);
  const withinBudget = tokens <= TIER1_TOKEN_BUDGET;
  out.write(
    `  ${withinBudget ? "✓" : "✗"} Tier-1 index ≈ ${tokens} tokens (budget ${TIER1_TOKEN_BUDGET})\n`,
  );

  const lock = await lib.readLock();
  out.write(`  • iris.lock pins ${lock.skills.length} skill(s)\n`);

  const healthy = nodeOk && errors.length === 0 && withinBudget;
  out.write(`\n${healthy ? "All good." : "Some checks need attention (see above)."}\n`);
  if (!healthy) process.exitCode = 1;
}
