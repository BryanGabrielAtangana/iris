// SPDX-License-Identifier: Apache-2.0
import type { Adapter } from "./adapter.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import { ChatAdapter } from "./chat.js";

export * from "./adapter.js";
export * from "./claude-code.js";
export * from "./codex.js";
export * from "./chat.js";
export * from "./fs-utils.js";

/** All built-in adapters keyed by name. */
export function builtinAdapters(): Record<string, Adapter> {
  const list: Adapter[] = [new ClaudeCodeAdapter(), new CodexAdapter(), new ChatAdapter()];
  return Object.fromEntries(list.map((a) => [a.name, a]));
}

export function getAdapter(name: string): Adapter | undefined {
  return builtinAdapters()[name];
}

export const DEFAULT_ADAPTERS = ["claude-code"];
