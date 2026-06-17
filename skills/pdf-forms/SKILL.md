---
name: pdf-forms
description: Fill, extract, merge, and split PDF documents and interactive forms.
when_to_use: Use when filling, extracting from, merging, or splitting PDF documents or forms.
when_not_to_use: Do not use for generating slide decks or editing raster images.
examples:
  - fill out this pdf form with my details
  - extract the text from a pdf
  - merge these two pdfs into one
  - split a pdf into separate pages
tags: [pdf, documents, forms, extraction]
version: 1.0.0
license: Apache-2.0
requires:
  packages: [pypdf]
  code_execution: true
---

# pdf-forms

Work with PDF documents: fill form fields, pull out text, and merge or split files.

## Steps

1. Identify the operation: fill, extract, merge, or split.
2. For form filling, enumerate field names first:
   ```bash
   python scripts/fields.py input.pdf
   ```
3. Apply the operation with `pypdf` (or `qpdf`/`pdftk` if available).
4. Verify the output opens and the fields/pages are correct.

## Notes

- Flatten filled forms when the recipient should not edit them.
- For scanned PDFs, OCR is out of scope — reach for a dedicated OCR skill.
