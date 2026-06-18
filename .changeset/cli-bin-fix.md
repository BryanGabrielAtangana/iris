---
"@iris-sylvia/cli": patch
---

Fix the `iris` CLI producing no output when run via `npx`/an installed bin. The
entrypoint used an `import.meta.url === argv[1]` guard that silently no-op'd when
invoked through npm's `.bin` symlink (argv[1] is the symlink path). The bin now
runs unconditionally; tests import `buildProgram` from `./program.js`.
