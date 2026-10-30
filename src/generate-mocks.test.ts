import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = path.join(import.meta.dir, "generate-mocks.ts");

const generateMocks = (...args: string[]) =>
  Bun.spawnSync([process.execPath, script, ...args], { stdout: "pipe", stderr: "pipe" });

const writeJson = (file: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{}");
};

describe("[generate-mocks] CLI", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "generate-mocks-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("should generate sorted mock imports with the JSON import attribute", () => {
    writeJson(path.join(dir, "mocks/api/client/GET.json"));
    writeJson(path.join(dir, "mocks/api/client/application/POST.json"));
    writeJson(path.join(dir, "mocks/api/client/application/GET.json"));
    writeJson(path.join(dir, "mocks/api/GET.json"));
    const output = path.join(dir, "mocks/mocks.ts");

    const result = generateMocks(`--folder=${path.join(dir, "mocks/api")}`, `--output=${output}`);

    expect(result.exitCode).toBe(0);
    // Sorted with localeCompare, which ranks letters before the trailing "/GET"
    expect(fs.readFileSync(output, "utf8")).toBe(`const mocks = {
  '/client/application/GET': import('./api/client/application/GET.json', { with: { type: 'json' } }),
  '/client/application/POST': import('./api/client/application/POST.json', { with: { type: 'json' } }),
  '/client/GET': import('./api/client/GET.json', { with: { type: 'json' } }),
  '/GET': import('./api/GET.json', { with: { type: 'json' } }),
} as const;

export default mocks;
`);
  });

  it("should skip JSON files that are not named after a supported method", () => {
    writeJson(path.join(dir, "api/client/GET.json"));
    writeJson(path.join(dir, "api/client/PATCH.json"));
    const output = path.join(dir, "out/mocks.ts");

    const result = generateMocks(`--folder=${path.join(dir, "api")}`, `--output=${output}`);

    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toContain("PATCH.json");
    expect(fs.readFileSync(output, "utf8")).not.toContain("PATCH");
    expect(fs.readFileSync(output, "utf8")).toContain("import('../api/client/GET.json', { with: { type: 'json' } })");
  });

  it("should exit with the usage when an argument is missing", () => {
    const result = generateMocks(`--folder=${dir}`);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Usage: generate-mocks --folder=<input-folder> --output=<output-file>");
  });
});
