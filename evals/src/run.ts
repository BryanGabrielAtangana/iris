// SPDX-License-Identifier: Apache-2.0
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { IrisLibrary } from "@iris-sylvia/core";
import { NaiveBaseline } from "./baseline.js";
import { evaluate, formatMetrics, type Metrics } from "./runner.js";

const here = dirname(fileURLToPath(import.meta.url));
/** Default to the repo's dogfood `skills/` library. */
export const DEFAULT_SKILLS_DIR = resolve(join(here, "..", "..", "skills"));

export interface BenchResult {
  iris: Metrics;
  baseline: Metrics;
}

export async function runBenchmark(skillsDir = DEFAULT_SKILLS_DIR): Promise<BenchResult> {
  const lib = new IrisLibrary({ root: skillsDir });
  await lib.load();

  const baseline = new NaiveBaseline();
  await baseline.index(lib.skills());

  const iris = await evaluate(lib);
  const base = await evaluate(baseline);
  return { iris, baseline: base };
}

async function main(): Promise<void> {
  const dir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SKILLS_DIR;
  const { iris, baseline } = await runBenchmark(dir);

  process.stdout.write(`Iris discovery benchmark — ${iris.total} labeled queries\n`);
  process.stdout.write(`Library: ${dir}\n\n`);
  process.stdout.write(formatMetrics("Baseline", baseline) + "\n");
  process.stdout.write(formatMetrics("Iris", iris) + "\n\n");

  const lift = ((iris.top1 - baseline.top1) * 100).toFixed(1);
  const verdict =
    iris.top1 > baseline.top1
      ? `Iris beats the naive baseline by ${lift} points on acc@1.`
      : `Iris did NOT beat the baseline (${lift} points). Investigate.`;
  process.stdout.write(verdict + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
