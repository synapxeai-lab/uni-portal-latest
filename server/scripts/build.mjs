// Production bundle: one ESM file in dist/. npm dependencies stay external
// (installed in the runtime image); "@/..." imports resolve through the
// tsconfig paths, and the @portal/shared workspace is TypeScript
// source, so it is bundled in.
import { readFileSync } from "node:fs";

import { build } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => name !== "@portal/shared");

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external,
  banner: {
    // Some CommonJS dependencies call require() - give the ESM bundle one.
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});

console.log("server built -> dist/index.js");
