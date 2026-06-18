<!-- SPDX-License-Identifier: Apache-2.0 -->

# Iris Search Strategy — Implementation Report

**Audience:** reviewer · **Status:** Task 0 (gate) complete & merged · **Date:** 2026-06-18

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

## 8. Remaining tasks (targets derived from the recorded baseline)

- **Task 1 — calibrated abstention:** lift negative rejection **67% → ≥90%**
  using top-1 absolute + top1→top2 margin + background z-score; surface
  `confidence` + `noStrongMatch` on `find_skill`; keep overall acc@1 ≥93%.
- **Task 2 — BM25 lexical:** replace raw token coverage (IDF + length norm,
  stopword removal). Enables strategy (1) and feeds the hybrid.
- **Task 3 — RRF fusion + the 3-way bench (§7):** remove the cross-scale 0.6/0.4
  blend; pick the default empirically.
- **Task 4 — per-field & per-example vectors:** embed `examples` as their own
  retrieval targets; score max-over-fields. The biggest remaining semantic lever.
- **Task 5 — model bench:** MiniLM vs bge-small vs e5-small (set by data).
- **Task 6 — content-hash embedding cache:** resolve vestigial persistence; also
  fixes the CI model-cache path warning.

## 9. Known issues

- CI model-cache path is slightly off (`HF_HOME` vs transformers.js's real cache
  dir) → harmless "path doesn't exist" warning; download still works (~6s).
- Hybrid weights and the lexical scorer are untuned — Tasks 2–3 address this.

---

**Bottom line:** the strategy is sound, the ruler is now honest, and the semantic
engine clears the bar by a wide margin (semantic-only +55.6 pts). The next lever
for _consistency_ is calibrated abstention (Task 1), followed by a **hybrid
BM25 + semantic** ranker chosen via the 3-way bench-off (Tasks 2–3).
