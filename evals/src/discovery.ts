// SPDX-License-Identifier: Apache-2.0
//
// Wild-discovery instrument (handoff v0.5 Task B). Two modes:
//
//   validate            (free, no agent) — drive find_skill directly with each
//                       probe and report whether the right skill RANKS #1. This
//                       is the retrieval-fires ceiling: it isolates that the only
//                       unmeasured variable left is the agent's *decision to call*.
//
//   score <log.jsonl…>  (after real agent runs) — read the MCP server's per-call
//                       JSONL (IRIS_LOG), grouped by session→probe and split by
//                       the Tier-1 awareness arm, and print unprompted-discovery
//                       rate (Tier-1 on vs off), end-to-end firing rate,
//                       false-fire rate on near-miss, and an error log of misses.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { IrisLibrary } from "@iris-sylvia/core";
import { DEFAULT_SKILLS_DIR } from "./accuracy.js";
import { PROBES, matchesProbe, type Probe } from "./discovery-probes.js";

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : "—");
const shouldFire = (p: Probe) => p.expect !== null;

// --- validate: retrieval-level ceiling, no agent, $0 -------------------------

async function validate(dir: string): Promise<void> {
  const lib = new IrisLibrary({ root: dir });
  await lib.load();
  process.stdout.write(
    `Discovery probe validation (retrieval-only; in-container engine)\nLibrary: ${dir}\n\n`,
  );

  const cats = ["obvious", "paraphrase", "ambiguous", "near-miss"] as const;
  for (const cat of cats) {
    const probes = PROBES.filter((p) => p.category === cat);
    let correct = 0;
    const misses: string[] = [];
    for (const p of probes) {
      const r = await lib.findDetailed(p.prompt, 5);
      const top = r.results[0];
      if (cat === "near-miss") {
        // "correct" = retrieval would not hand the agent a confident wrong skill.
        if (r.noStrongMatch) correct++;
        else misses.push(`  ${p.id}: top1=${top?.id} (conf ${top?.confidence?.toFixed(2)})`);
      } else {
        if (top && matchesProbe(p.expect, top.id)) correct++;
        else misses.push(`  ${p.id}: top1=${top?.id ?? "—"} want ${JSON.stringify(p.expect)}`);
      }
    }
    process.stdout.write(`${cat.padEnd(11)} ${pct(correct, probes.length)} (${correct}/${probes.length})\n`);
    for (const m of misses) process.stdout.write(`${m}\n`);
  }
  process.stdout.write(
    `\nNote: in-container retrieval uses the lexical fallback (no model access here),\n` +
      `and noStrongMatch is calibrated for the semantic engine — treat near-miss\n` +
      `abstention as indicative only. This validates the probe set + instrument;\n` +
      `the unprompted-discovery + Tier-1 A/B read comes from 'score' on real runs.\n`,
  );
}

// --- score: real agent runs --------------------------------------------------

interface Event {
  session: string;
  awareness: boolean;
  tool: "find_skill" | "load_skill";
  id?: string;
  found?: boolean;
}

interface RunRollup {
  calledFind: boolean;
  loadedCorrect: boolean;
  loadedAny: boolean;
}

function probeOf(session: string): Probe | undefined {
  const pid = session.split("#")[0];
  return PROBES.find((p) => p.id === pid);
}

function score(files: string[]): void {
  const events: Event[] = [];
  for (const f of files) {
    for (const line of readFileSync(resolve(f), "utf8").split("\n")) {
      if (line.trim()) events.push(JSON.parse(line) as Event);
    }
  }
  // session → rollup (a session is one probe run under one arm).
  const runs = new Map<string, { probe: Probe; awareness: boolean; roll: RunRollup }>();
  for (const e of events) {
    const probe = probeOf(e.session);
    if (!probe) continue;
    const key = e.session;
    const r =
      runs.get(key) ??
      runs.set(key, { probe, awareness: e.awareness, roll: { calledFind: false, loadedCorrect: false, loadedAny: false } }).get(key)!;
    if (e.tool === "find_skill") r.roll.calledFind = true;
    if (e.tool === "load_skill" && e.found) {
      r.roll.loadedAny = true;
      if (e.id && matchesProbe(probe.expect, e.id)) r.roll.loadedCorrect = true;
    }
  }

  for (const arm of [true, false]) {
    const armRuns = [...runs.values()].filter((r) => r.awareness === arm);
    if (armRuns.length === 0) continue;
    const fire = armRuns.filter((r) => shouldFire(r.probe));
    const near = armRuns.filter((r) => !shouldFire(r.probe));
    const called = fire.filter((r) => r.roll.calledFind).length;
    const fired = fire.filter((r) => r.roll.loadedCorrect).length;
    const falseFire = near.filter((r) => r.roll.loadedAny).length;

    process.stdout.write(`\n=== Tier-1 ${arm ? "ON" : "OFF"} (${armRuns.length} runs) ===\n`);
    process.stdout.write(`unprompted-discovery: ${pct(called, fire.length)} (${called}/${fire.length} should-fire runs called find_skill)\n`);
    process.stdout.write(`end-to-end firing:    ${pct(fired, fire.length)} (${fired}/${fire.length} loaded the correct skill)\n`);
    process.stdout.write(`  of those that called: ${pct(fired, called)} (${fired}/${called})\n`);
    process.stdout.write(`false-fire on near-miss: ${pct(falseFire, near.length)} (${falseFire}/${near.length} loaded a skill anyway)\n`);
    const misses = fire.filter((r) => !r.roll.loadedCorrect).map((r) => `  miss ${r.probe.id}: called=${r.roll.calledFind} loadedCorrect=${r.roll.loadedCorrect}`);
    for (const m of misses) process.stdout.write(`${m}\n`);
  }
}

async function main(): Promise<void> {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "print") {
    // Emit `<id>\t<expect>\t<prompt>` for the runner / manual paste.
    for (const p of PROBES) {
      process.stdout.write(`${p.id}\t${JSON.stringify(p.expect)}\t${p.prompt}\n`);
    }
  } else if (mode === "score") {
    if (rest.length === 0) {
      process.stderr.write("usage: discovery score <log.jsonl> [more.jsonl…]\n");
      process.exit(2);
    }
    score(rest);
  } else {
    await validate(rest[0] ? resolve(rest[0]) : DEFAULT_SKILLS_DIR);
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
