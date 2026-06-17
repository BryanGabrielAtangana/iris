// SPDX-License-Identifier: Apache-2.0
import chokidar from "chokidar";

export type Unsubscribe = () => void;

export interface WatchOptions {
  /** Debounce window in ms to coalesce bursts of file events. */
  debounceMs?: number;
}

/**
 * Watch a library root for skill changes and invoke `onChange` (debounced).
 * Used to drive MCP `tools/listChanged` / `resources/updated` notifications.
 */
export function watchLibrary(
  root: string,
  onChange: () => void | Promise<void>,
  opts: WatchOptions = {},
): Unsubscribe {
  const debounceMs = opts.debounceMs ?? 200;
  let timer: NodeJS.Timeout | undefined;
  let closed = false;

  const trigger = (): void => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void onChange();
    }, debounceMs);
  };

  const watcher = chokidar.watch(root, {
    ignored: (path: string) =>
      /(^|[/\\])(node_modules|\.git|\.turbo|dist|\.iris)([/\\]|$)/.test(path),
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on("add", trigger).on("change", trigger).on("unlink", trigger);

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    void watcher.close();
  };
}
