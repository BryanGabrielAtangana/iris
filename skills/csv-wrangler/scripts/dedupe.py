# SPDX-License-Identifier: Apache-2.0
"""Remove duplicate rows from a CSV, preserving header and first-seen order."""
import csv
import sys

def main() -> int:
    if len(sys.argv) < 2:
        print("usage: dedupe.py <input.csv>", file=sys.stderr)
        return 2
    seen = set()
    with open(sys.argv[1], newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        writer = csv.writer(sys.stdout)
        for i, row in enumerate(reader):
            key = tuple(row)
            if i == 0 or key not in seen:
                writer.writerow(row)
                seen.add(key)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
