// Production bundle: one ESM file in dist/. npm dependencies stay external
// (installed in the runtime image); "@/..." imports resolve through the
// tsconfig paths, and the @portal/shared workspace is TypeScript
// source, so it is bundled in.
import { readFileSync } from "node:fs";

import { build } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => name !== "@portal/shared");

await build({
  // create-admin: creates the first admin in production (no tsx there).
  // seed: the demo data (admin, teachers, students, courses...), run on demand.
  entryPoints: {
    index: "src/index.ts",
    "create-admin": "scripts/create-admin.ts",
    seed: "prisma/seed.ts",
  },
  outdir: "dist",
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

console.log("server built -> dist/index.js, dist/create-admin.js, dist/seed.js");
