#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Print a compact summary of staged changes to seed a commit message.
set -euo pipefail
echo "Files staged:"
git diff --cached --name-status
echo
echo "Stat:"
git diff --cached --stat
