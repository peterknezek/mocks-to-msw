import { $ } from "bun";
import { rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });

await Bun.build({
  entrypoints: ["src/index.ts", "src/generate-mocks.ts"],
  outdir: "dist",
  target: "node",
  format: "esm",
  packages: "external",
});

// bun build does not emit declarations; tsc does
await $`tsc -p tsconfig.build.json`;
