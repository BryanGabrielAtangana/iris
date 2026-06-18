<!-- SPDX-License-Identifier: Apache-2.0 -->

# Wild-discovery validation — runbook (v0.5 Task B)

The retrieval evals all answer "given `find_skill` is called, does the right
skill rank #1?" This instrument answers the question the product actually lives
on: **does the agent call `find_skill` unprompted at the moment of intent, and
does the right skill fire end-to-end?** — and **how much of that does the Tier-1
awareness index cause?**

It is a directional instrument, not a CI gate. Running the live A/B costs money
(headless Claude Code: ~$0.04+ per invocation), so it is **opt-in and run by
hand**, not on every push.

## What's built

- **Telemetry** — the MCP server appends one JSONL line per `find_skill` /
  `load_skill` call (query, top-k + scores + `confidence`, `noStrongMatch`, the
  Tier-1 arm, a session id, timestamp) when `IRIS_LOG` is set.
- **Tier-1 toggle** — `IRIS_NO_AWARENESS=1` withholds the awareness index from the
  `find_skill` description (the tool stays available). This is the A/B's "off" arm.
- **Probe set** — `evals/src/discovery-probes.ts`: ~30 blind prompts (obvious /
  paraphrase / near-miss / ambiguous) that never name a skill.
- **Scorer** — `pnpm --filter @iris-sylvia/evals discovery score <log.jsonl>`:
  unprompted-discovery rate (Tier-1 on vs off), end-to-end firing rate,
  false-fire rate on near-miss, and an error log.
- **Free pre-check** — `pnpm --filter @iris-sylvia/evals discovery` (no args):
  drives `find_skill` directly with each probe (no agent, $0) to confirm the
  right skill is *retrievable* (#1). This isolates that the only unmeasured
  variable left is the agent's decision to call.

## Run the live A/B

```bash
pnpm build
# cheap directional read (~24 runs on Haiku): one repeat, both Tier-1 arms
REPEATS=1 MODEL=haiku evals/scripts/discovery-run.sh
# full protocol with spread: 3 repeats (≈ 30 × 2 × 3 = 180 runs)
REPEATS=3 MODEL=haiku evals/scripts/discovery-run.sh
```

The runner writes telemetry to `discovery-<ts>.jsonl` and prints the scored
table at the end. Re-score any saved log with
`pnpm --filter @iris-sylvia/evals discovery score discovery-*.jsonl`.

> Notes: the runner uses `--permission-mode bypassPermissions` and restricts the
> agent to the two Iris tools so it can run unattended; adjust the flag if your
> `claude` version differs. For a faithful read, point `[skills-dir]` at a real
> 15–30 skill library (the eval skills plus a few of your own), and run where the
> MCP server can load the **semantic** model (this repo's CI sandbox is
> firewalled, so a local run gives the higher-quality retrieval).

## The stop-and-think gate

If unprompted-discovery is **low even with Tier-1 on**, that is the most
important finding in the project so far: the bottleneck is the **awareness
surface** (Tier-1 copy/placement + the tool description), not retrieval. In that
case the next work is the surface, not more ranking — report it loudly.
