// SPDX-License-Identifier: Apache-2.0
//
// Model-evaluation sweep (handoff v0.4): measure ONE dense engine on the settled
// ranker (blob representation, blend@.3) and emit its quality + cost rows. Run
// once per model (MODEL_KEY env / argv) so each model is cost-isolated, cached
// under its own key, and a model that won't load in transformers.js fails this
// job alone instead of the whole sweep.
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { statSync, readdirSync } from "node:fs";
import { IrisLibrary } from "@iris-sylvia/core";
import {
  TransformersEmbeddingProvider,
  LocalHashingProvider,
  modelByKey,
  cosineSimilarity,
  embedQueries,
  type EmbeddingProvider,
} from "@iris-sylvia/embeddings";
import { evaluate } from "./runner.js";
import { matchesExpected, type EvalCase } from "./dataset.js";
import { DEFAULT_SKILLS_DIR } from "./accuracy.js";
import { POSITIVES, AMBIGUOUS, SEMANTIC_ONLY, EXACT_VOCABULARY, NEGATIVES_OOD, NEGATIVES_NEARMISS } from "./v3.js";

const ALL_POSITIVES: EvalCase[] = [...POSITIVES, ...AMBIGUOUS];
const ALL_NEGATIVES: string[] = [...NEGATIVES_OOD, ...NEGATIVES_NEARMISS];
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Highest-precision rejection point: max recall s.t. precision ≥ minP. */
function bestRejection(acceptConf: number[], rejectConf: number[], minP = 0.95) {
  let best = { recall: 0, precision: 1, threshold: 0 };
  for (const c of [...acceptConf, ...rejectConf].sort((a, b) => a - b)) {
    const t = c + 1e-9;
    const negFlag = rejectConf.filter((x) => x < t).length;
    const posFlag = acceptConf.filter((x) => x < t).length;
    const precision = negFlag + posFlag ? negFlag / (negFlag + posFlag) : 1;
    const recall = negFlag / (rejectConf.length || 1);
    if (precision >= minP && recall > best.recall) best = { recall, precision, threshold: t };
  }
  return best;
}

function dirSizeBytes(dir: string): number {
  let total = 0;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      total += e.isDirectory() ? dirSizeBytes(p) : statSync(p).size;
    }
  } catch {
    /* missing dir */
  }
  return total;
}

async function withRetries<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
}

async function main(): Promise<void> {
  const key = process.env.MODEL_KEY ?? process.argv[2];
  const dir = DEFAULT_SKILLS_DIR;
  const spec = key ? modelByKey(key) : undefined;
  if (!spec) {
    process.stderr.write(`Unknown MODEL_KEY "${key}". Known: minilm bge-small e5-small nomic embeddinggemma\n`);
    process.exit(2);
  }
  process.stdout.write(`Iris model sweep — ${spec.key} (${spec.model})\n`);

  // Build the provider and force-load it; record unavailable + exit 0 on failure
  // so one unloadable model doesn't fail the whole matrix.
  let provider: EmbeddingProvider;
  let loadMs = 0;
  try {
    const p = new TransformersEmbeddingProvider(spec);
    const t0 = performance.now();
    await withRetries(() => p.warm(), process.env.CI ? 4 : 0);
    loadMs = performance.now() - t0;
    provider = p;
  } catch (err) {
    process.stdout.write(`\nRESULT ${spec.key}: UNAVAILABLE — ${err instanceof Error ? err.message : String(err)}\n`);
    process.stdout.write(`(transformers.js could not load this model; recorded as a negative result.)\n`);
    return;
  }
  if (provider instanceof LocalHashingProvider) return; // unreachable; keeps types happy

  // Acceptance gate #1: a prefixed query must differ from the document encoding
  // for asymmetric models, or the prefix isn't wired and every number is invalid.
  const probe = "fill out a pdf form with my details";
  const [docVec] = await provider.embed([probe]);
  const [qVec] = await embedQueries(provider, [probe]);
  const prefixDelta = 1 - cosineSimilarity(docVec ?? [], qVec ?? []);
  const asymmetric = (spec.queryPrefix ?? "") !== (spec.documentPrefix ?? "");
  if (asymmetric && prefixDelta < 1e-4) {
    process.stdout.write(
      `\n[gate] WARNING ${spec.key}: prefixΔ ${prefixDelta.toExponential(2)} — query/doc prefixes look UNWIRED.\n`,
    );
  }

  const rssBefore = process.memoryUsage().rss;
  const lib = new IrisLibrary({ root: dir, provider }); // blob + blend@.3 defaults
  await lib.load();

  // --- Quality per subset (blend@.3) ---
  const subsets: { name: string; cases: EvalCase[] }[] = [
    { name: "full", cases: ALL_POSITIVES },
    { name: "semantic-only", cases: SEMANTIC_ONLY },
    { name: "exact-vocab", cases: EXACT_VOCABULARY },
  ];
  const quality: Record<string, { top1: number; top3: number; mrr: number }> = {};
  for (const s of subsets) quality[s.name] = await evaluate(lib, s.cases);

  // --- Abstention: blended top-1 confidence, and the decoupled pure-semantic top-1 ---
  const acceptBlend: number[] = [];
  const acceptSem: number[] = [];
  const latencies: number[] = [];
  for (const c of ALL_POSITIVES) {
    const t0 = performance.now();
    const r = await lib.find(c.query, 999);
    latencies.push(performance.now() - t0);
    if (r[0] && matchesExpected(c.expected, r[0].id)) {
      acceptBlend.push(r[0].confidence ?? 0);
      const sig = await lib.signals(c.query);
      acceptSem.push(Math.max(0, ...sig.map((x) => x.semantic)));
    }
  }
  const rejectBlend: number[] = [];
  const rejectSem: number[] = [];
  for (const q of ALL_NEGATIVES) {
    const r = await lib.find(q, 999);
    rejectBlend.push(r[0]?.confidence ?? 0);
    const sig = await lib.signals(q);
    rejectSem.push(Math.max(0, ...sig.map((x) => x.semantic)));
  }
  const blendRej = bestRejection(acceptBlend, rejectBlend);
  const semRej = bestRejection(acceptSem, rejectSem);

  // --- Cost ---
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const rssPeakMB = Math.max(rssBefore, process.memoryUsage().rss) / 1024 / 1024;
  const cacheMB = process.env.IRIS_MODEL_CACHE ? dirSizeBytes(process.env.IRIS_MODEL_CACHE) / 1024 / 1024 : 0;

  // --- Emit ---
  process.stdout.write(
    `\nModel: ${provider.name}  dim=${provider.dimensions}  pooling=${spec.pooling ?? "mean"}  dtype=${spec.dtype}  prefixΔ=${prefixDelta.toFixed(4)}  (${spec.sizeClass})\n`,
  );
  for (const s of subsets) {
    const m = quality[s.name]!;
    process.stdout.write(`  ${s.name.padEnd(14)} acc@1 ${pct(m.top1).padStart(6)}  acc@3 ${pct(m.top3).padStart(6)}  MRR ${m.mrr.toFixed(3)}\n`);
  }
  process.stdout.write(
    `  abstain(blend)   recall ${pct(blendRej.recall)} @P ${pct(blendRej.precision)}  threshold ${blendRej.threshold.toFixed(3)}\n`,
  );
  process.stdout.write(
    `  abstain(semantic) recall ${pct(semRej.recall)} @P ${pct(semRej.precision)}  threshold ${semRej.threshold.toFixed(3)}\n`,
  );
  process.stdout.write(
    `  cost: download ${cacheMB.toFixed(0)} MB  load ${loadMs.toFixed(0)} ms  embed p50 ${p50.toFixed(1)} ms p95 ${p95.toFixed(1)} ms  rss ${rssPeakMB.toFixed(0)} MB\n`,
  );
  // Single machine-greppable line for cross-model aggregation from job logs.
  process.stdout.write(
    `RESULT ${spec.key} pool=${spec.pooling ?? "mean"} prefixD=${prefixDelta.toFixed(4)} full=${pct(quality.full!.top1)} sem=${pct(quality["semantic-only"]!.top1)} exact=${pct(quality["exact-vocab"]!.top1)} rejBlend=${pct(blendRej.recall)} rejSem=${pct(semRej.recall)} dl=${cacheMB.toFixed(0)}MB load=${loadMs.toFixed(0)}ms p95=${p95.toFixed(1)}ms rss=${rssPeakMB.toFixed(0)}MB\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
