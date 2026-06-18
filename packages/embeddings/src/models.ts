// SPDX-License-Identifier: Apache-2.0
import type { TransformersOptions } from "./transformers.js";

/**
 * Candidate dense engines for the model-evaluation sweep (handoff v0.4).
 *
 * Prefix/prompt schemes are transcribed from each model card — getting them
 * wrong silently invalidates the comparison. `nativeDim` is the model's output
 * dim; MRL models are truncated to `truncateDim` and re-normalized so the brute
 * store stays small.
 */
export interface ModelSpec extends TransformersOptions {
  /** Short label used in the sweep tables and cache keys. */
  key: string;
  /** Native output dimensionality before any MRL truncation. */
  nativeDim: number;
  /** Rough class for the cost lens: XS / S / M. */
  sizeClass: "XS" | "S" | "M";
  /** One-line note for the report. */
  note: string;
}

export const MODEL_SLATE: ModelSpec[] = [
  {
    key: "minilm",
    model: "Xenova/all-MiniLM-L6-v2",
    nativeDim: 384,
    sizeClass: "XS",
    queryPrefix: "",
    documentPrefix: "",
    dtype: "q8",
    note: "current default; symmetric/general — the bar to beat",
  },
  {
    key: "bge-small",
    model: "Xenova/bge-small-en-v1.5",
    nativeDim: 384,
    sizeClass: "XS",
    // bge-small uses a query instruction; documents get no prefix.
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    documentPrefix: "",
    dtype: "q8",
    note: "drop-in dim; asymmetric query instruction",
  },
  {
    key: "e5-small",
    model: "Xenova/e5-small-v2",
    nativeDim: 384,
    sizeClass: "XS",
    queryPrefix: "query: ",
    documentPrefix: "passage: ",
    dtype: "q8",
    note: "drop-in dim; asymmetric query/passage",
  },
  {
    key: "nomic",
    model: "nomic-ai/nomic-embed-text-v1.5",
    nativeDim: 768,
    truncateDim: 256,
    sizeClass: "S",
    queryPrefix: "search_query: ",
    documentPrefix: "search_document: ",
    dtype: "q8",
    note: "768-dim MRL → truncate to 256; asymmetric",
  },
  {
    key: "embeddinggemma",
    model: "onnx-community/embeddinggemma-300m-ONNX",
    nativeDim: 768,
    truncateDim: 256,
    sizeClass: "M",
    // EmbeddingGemma retrieval prompts.
    queryPrefix: "task: search result | query: ",
    documentPrefix: "title: none | text: ",
    // fp16 is explicitly unsupported for this model; q8 keeps it on the small side.
    dtype: "q8",
    note: "on-device SOTA candidate; 300M, heaviest — watch cost",
  },
];

export function modelByKey(key: string): ModelSpec | undefined {
  return MODEL_SLATE.find((m) => m.key === key);
}
