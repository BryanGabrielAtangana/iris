<!-- SPDX-License-Identifier: Apache-2.0 -->

# Iris Search Strategy — Implementation Report

**Audience:** reviewer · **Status:** Task 0 (gate) merged · Task 4 (per-field) **rejected — negative result** · Task 2 (BM25) in review · **Date:** 2026-06-18

## 1. Thesis

Iris's only durable advantage is **consistent discovery**: the right skill,
instantly, _every time_ — including when the user phrases a request nothing like
the skill. Two metrics govern this: **acc@1** (does the right skill rank #1) and
**negative rejection** (does it abstain on off-topic asks). Everything below
serves those two.

## 2. The retrieval strategy (as shipped in 0.2.x)

`find_skill(query)` works in three moves:

1. **Index doc per skill** — weighted concat of `name`×2, `description`,
   `when_to_use`×2, `examples`, `tags`; embedded once into a brute-force
   in-memory cosine store (exact, zero-infra, sub-ms at library scale).
2. **Embedding engine** — default is **on-device semantic** (transformers.js,
   `all-MiniLM-L6-v2`, 384-d), with an automatic **fallback to a lexical hashing
   engine** when the model can't load (offline/firewalled). Tier-1 awareness is
   separate and drives _unprompted_ firing.
3. **Hybrid score** — `0.6·cosine + 0.4·lexical`, sorted, top-k.

## 3. The core problem fixed first (Task 0)

The benchmark couldn't prove value. The "hard" cases were labeled as
vocabulary-avoiding paraphrases, yet the **lexical** engine scored **87.5%** on
them — the cases leaked surface form, leaving no headroom to observe semantic
lift. **You can't tune what you can't measure**, so the first task was to fix the
ruler.

## 4. What was implemented (Task 0)

- **Bigger, realer library:** 8 → **15 skills**, enabling near-miss confusability.
- **112 positives / 52 negatives**, plus **ambiguous** positives (any-of accepted).
- **`SEMANTIC_ONLY` subset (18):** paraphrases with _no shared surface form_ —
  and because the lexical engine uses **character n-grams**, the cases avoid
  shared substrings too (e.g. not "update" near `changelog-update`, not
  "relational" near the SQL skill). Iterated against the lexical engine until it
  dropped below the gate.
- **Near-miss negatives:** in-domain-_sounding_ but uncovered ("deploy my
  container to a kubernetes cluster", "optimize this SQL query's execution
  plan") — must be **rejected**.
- **Abstention precision/recall curve** with the best operating point (replaces a
  fixed 0.2 cutoff).
- **CI `accuracy` job + model cache** so the **semantic** engine is measured on a
  runner that can reach Hugging Face. (A restricted sandbox can't download the
  model — which is why this measurement lives in CI, and validated the
  offline-fallback path.)
- A **regression test** that fails if the semantic-only subset leaks back above
  40% lexically.

## 5. Results — the honest benchmark

Measured on the rebuilt set (15 skills, 112 positives, 52 negatives):

| Metric                  | Lexical (hashing) | **Semantic (MiniLM)**            | Δ           |
| ----------------------- | ----------------- | -------------------------------- | ----------- |
| **Semantic-only acc@1** | 27.8%             | **83.3%**                        | **+55.6 pts** |
| Overall acc@1           | 85.7%             | **95.5%**                        | +9.8 pts    |
| acc@3                   | 93.8%             | **100%**                         | —           |
| MRR                     | 0.897             | **0.978**                        | —           |
| Negative rejection @0.2 | 34.6%             | **67.3%**                        | +32.7 pts   |
| Best abstention F1      | —                 | **0.907** @ t=0.3 (P 95.1/R 86.6) | —           |
| Median latency          | 0.37 ms           | 9.69 ms                          | still fast  |

**What it proves:** the eval isolates _meaning_ (lexical 27.8% — it genuinely
can't do semantic-only) **and Iris recovers it** (semantic 83.3%). That
+55.6-pt gap _is_ the product claim, on a benchmark engineered to be honest.
Positives mean 0.542 vs negatives 0.171 — clean separation, the foundation for
confident abstention.

## 6. DoD status (Task 0)

| Criterion                       | Result        |
| ------------------------------- | ------------- |
| Lexical ≤40% on semantic-only   | ✅ 27.8%      |
| Semantic ≥75% on semantic-only  | ✅ **83.3%**  |
| ≥100 positives / ≥50 negatives  | ✅ 112 / 52   |
| Both engines printed in CI      | ✅            |

## 7. Recommended direction: **hybrid retrieval (BM25 + semantic)**, chosen by a 3-way bench

The current default is semantic-only with a lexical fallback. The strongest
production setups **fuse** a sparse lexical signal (BM25) with dense semantic,
because each covers the other's blind spot:

- **BM25** wins on exact/rare-term matches — skill names and jargon
  (`kubernetes`, `regex`, `cron`) — i.e. when the user types the literal
  vocabulary. It is also naturally near-zero on out-of-domain text (good for
  rejection).
- **Semantic** wins on paraphrase/synonym intent — the +55.6-pt lever proven
  above.
- **Fusing the two via Reciprocal Rank Fusion** (`score = Σ 1/(k+rank)`, k=60)
  typically beats either alone and is robust because it combines _ranks_, not
  raw scores on different scales.

**Decide by data, not assumption.** Before committing a default, run a
head-to-head on the rebuilt eval across **all three strategies**:

| Strategy            | Engine                                     |
| ------------------- | ------------------------------------------ |
| **(1) Lexical/BM25**| sparse only (BM25 over trigger text)       |
| **(2) Semantic**    | dense only (transformers.js)               |
| **(3) Hybrid**      | RRF fusion of BM25 + semantic rankings     |

Report **acc@1, acc@3, MRR, negative rejection, and abstention F1** for each,
and set the default from the winner. The accuracy harness already prints
per-engine; it will be extended to emit this **3-way comparison table** (in the
CI `accuracy` job, where the semantic model is reachable). Hypothesis: hybrid
leads on overall acc@1 and negative rejection, semantic leads on the
semantic-only subset, BM25 leads on exact-vocabulary queries — and the fused
ranker captures most of all three.

## 8. Task 4 (per-field embeddings) — **a measured negative result**

The handoff predicted per-field + examples-as-targets would be "the biggest
remaining semantic lever." **The data said the opposite**, and the honest ruler
caught it. Embedding each field separately and scoring **max-over-fields**
regressed the dense engine on exactly the metric that matters:

| Semantic engine (MiniLM, CI) | Blob baseline | Per-field (all fields) | Per-field (blob-anchored) |
| ---------------------------- | ------------- | ---------------------- | ------------------------- |
| **Semantic-only acc@1**      | **83.3%**     | 72.2%                  | 61.1%                     |
| Overall acc@1                | 95.5%         | 94.6%                  | 92.9%                     |
| Negative rejection @0.2      | 67.3%         | 48.1%                  | 48.1%                     |
| MRR                          | 0.978         | 0.972                  | 0.964                     |

**Why:** `max`-over-fields raises *every* skill's score (each extra field is
another chance to match), lifting the noise floor and flipping rankings on
paraphrases — the precise queries the dense engine exists for. Even anchoring on
the full blob and adding only `when_to_use`/`examples` as extra targets regressed
*further*. **The single holistic blob vector is the strongest dense
representation here.** (Per-field *does* help the lexical hashing fallback, but
that is the offline fallback, not the moat.) The **CI semantic floor** (≥70% on
the semantic-only subset, added in Task 0 hardening) failed automatically at
61.1% and blocked the merge — the measurement infrastructure did its job.
**Decision: keep the blob baseline; PR closed.**

## 9. Remaining tasks (targets derived from the recorded baseline)

- **Task 2 — BM25 lexical — DONE (in review).** Replaced raw token-coverage with
  corpus-aware BM25 (IDF + length norm, stopwords; name signal folded in as a
  field weight). Lexical-engine overall acc@1 85.7% → **87.5%**; BM25 is exactly
  0 on no-overlap queries (rejection floor). Regression test extended: **BM25-only
  stays ≤ 40%** on the semantic-only subset (measured 33.3%). Enables strategy (1)
  and feeds the hybrid.
- **Task 3 — RRF fusion + the 3-way bench (§7):** remove the cross-scale 0.6/0.4
  blend; pick the default empirically (subsumes the old model bench: MiniLM vs
  bge-small vs e5-small).
- **Task 1 — calibrated abstention:** lift negative rejection **67% → ≥90%**
  using top-1 absolute + top1→top2 margin + background z-score; surface
  `confidence` + `noStrongMatch` on `find_skill`; keep overall acc@1 ≥93%. Tuned
  on the Task 3 winner.
- **Task 6 — content-hash embedding cache:** resolve vestigial persistence; also
  fixes the CI model-cache path warning.

## 10. Known issues

- CI model-cache path is slightly off (`HF_HOME` vs transformers.js's real cache
  dir) → harmless "path doesn't exist" warning; download still works (~6s).
  Fixed by Task 6.
- The combined lexical engine sits at 38.9% on the semantic-only subset (gate is
  ≤40%) — passing but tight. A handful of paraphrases legitimately share one
  content word with their skill; growing the subset toward ~40 cases (with CI
  validation of the semantic floor) is tracked as Task 0 residual.

---

**Bottom line:** the ruler is honest enough that it **rejected a predicted win**
(Task 4) on the metric that matters — that is the system working. The blob remains
the dense representation; BM25 now backs the lexical side. The next lever for
_consistency_ is the **hybrid RRF bench-off** (Task 3), then calibrated abstention
(Task 1) tuned on whatever ranker wins.
