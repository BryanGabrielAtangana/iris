// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: { entry: ["src/index.ts"] },
  banner: { js: "" },
  clean: true,
  sourcemap: true,
  target: "es2022",
});
