#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Wild-discovery A/B runner (handoff v0.5 Task B). Drives the blind probe set
# through Claude Code headlessly with the Iris MCP server connected over stdio,
# under both Tier-1 arms, and scores the resulting JSONL telemetry.
#
# THIS COSTS MONEY: each `claude -p` invocation re-creates the Claude Code system
# prompt cache (~$0.04+ floor). Full protocol = #probes × 2 arms × REPEATS runs.
# Start with REPEATS=1 and MODEL=haiku for a cheap directional read.
#
# Usage:  REPEATS=1 MODEL=haiku evals/scripts/discovery-run.sh [skills-dir]
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SKILLS="${1:-$REPO/skills}"
REPEATS="${REPEATS:-1}"
MODEL="${MODEL:-haiku}"
LOG="${IRIS_LOG:-$REPO/discovery-$(date +%s).jsonl}"
CLI="$REPO/packages/mcp-server/dist/cli.js"

command -v claude >/dev/null || { echo "claude CLI not found"; exit 1; }
[ -f "$CLI" ] || { echo "build first: pnpm build"; exit 1; }
: > "$LOG"
echo "log: $LOG   model: $MODEL   repeats: $REPEATS"

run_probe() {  # id  expect  prompt  awareness(1=on,0=off)
  local id="$1" prompt="$3" aware="$4" rep="$5"
  local noaware=""; [ "$aware" = "0" ] && noaware="1"
  local cfg; cfg="$(mktemp)"
  cat > "$cfg" <<JSON
{ "mcpServers": { "iris": { "command": "node", "args": ["$CLI", "$SKILLS"],
  "env": { "IRIS_LOG": "$LOG", "IRIS_SESSION": "$id#$rep$( [ "$aware" = 0 ] && echo -off )",
           "IRIS_NO_AWARENESS": "$noaware", "IRIS_NO_EXEC": "1" } } } }
JSON
  claude -p "$prompt" --model "$MODEL" \
    --strict-mcp-config --mcp-config "$cfg" \
    --allowedTools "mcp__iris__find_skill" "mcp__iris__load_skill" \
    --permission-mode bypassPermissions \
    --output-format json >/dev/null 2>&1 || echo "  (run failed: $id aware=$aware)"
  rm -f "$cfg"
}

while IFS=$'\t' read -r id expect prompt; do
  for rep in $(seq 1 "$REPEATS"); do
    for aware in 1 0; do
      echo "probe $id  aware=$aware  rep=$rep"
      run_probe "$id" "$expect" "$prompt" "$aware" "$rep"
    done
  done
done < <(pnpm -s --filter @iris-sylvia/evals discovery print)

echo; echo "=== scoring ==="
pnpm -s --filter @iris-sylvia/evals discovery score "$LOG"
