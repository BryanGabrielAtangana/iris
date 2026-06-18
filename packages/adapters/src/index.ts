// SPDX-License-Identifier: Apache-2.0
import type { Adapter } from "./adapter.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import { CursorAdapter } from "./cursor.js";
import { ChatAdapter } from "./chat.js";

export * from "./adapter.js";
export * from "./claude-code.js";
export * from "./codex.js";
export * from "./cursor.js";
export * from "./chat.js";
export * from "./fs-utils.js";

/** All built-in adapters keyed by name. */
export function builtinAdapters(): Record<string, Adapter> {
  const list: Adapter[] = [
    new ClaudeCodeAdapter(),
    new CodexAdapter(),
    new CursorAdapter(),
    new ChatAdapter(),
  ];
  return Object.fromEntries(list.map((a) => [a.name, a]));
}

/** Names of all built-in adapters, for help text and validation. */
export function adapterNames(): string[] {
  return Object.keys(builtinAdapters());
}

export function getAdapter(name: string): Adapter | undefined {
  return builtinAdapters()[name];
}

export const DEFAULT_ADAPTERS = ["claude-code"];
