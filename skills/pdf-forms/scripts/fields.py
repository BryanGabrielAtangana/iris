# SPDX-License-Identifier: Apache-2.0
"""Print the form field names of a PDF (requires pypdf)."""
import sys

def main() -> int:
    if len(sys.argv) < 2:
        print("usage: fields.py <input.pdf>", file=sys.stderr)
        return 2
    try:
        from pypdf import PdfReader
    except ImportError:
        print("pypdf is not installed; run: pip install pypdf", file=sys.stderr)
        return 1
    reader = PdfReader(sys.argv[1])
    fields = reader.get_fields() or {}
    for name in fields:
        print(name)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
