import { $ } from "bun";
import { copyFile, rm } from "node:fs/promises";

const entries = ["index", "generate-mocks"];

await rm("dist", { recursive: true, force: true });

for (const format of ["esm", "cjs"] as const) {
  await Bun.build({
    entrypoints: entries.map((name) => `src/${name}.ts`),
    outdir: "dist",
    target: "node",
    format,
    packages: "external",
    naming: format === "cjs" ? "[dir]/[name].cjs" : "[dir]/[name].js",
  });
}

// bun build does not emit declarations; tsc does, and the CJS entry gets a copy
await $`tsc -p tsconfig.build.json`;
for (const name of entries) {
  await copyFile(`dist/${name}.d.ts`, `dist/${name}.d.cts`);
}
