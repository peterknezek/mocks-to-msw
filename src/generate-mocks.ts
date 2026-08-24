#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseArgs as parseNodeArgs } from "node:util";
import type { Dirent } from "node:fs";

interface MockEntries {
  [key: string]: string;
}

const SUPPORTED_METHODS = ["GET", "POST", "PUT", "DELETE"];

function scanDirectory(dir: string, basePath: string, outputFile: string): MockEntries {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result: MockEntries = {};

  entries.forEach((entry: Dirent) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      Object.assign(result, scanDirectory(fullPath, path.join(basePath, entry.name), outputFile));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      const method = path.basename(entry.name, ".json");
      if (!SUPPORTED_METHODS.includes(method)) {
        console.warn(
          `Skipping "${fullPath}": file name must be one of the supported HTTP methods (${SUPPORTED_METHODS.join(", ")})`
        );
        return;
      }

      // basePath is relative to the input folder; mock keys always use forward slashes
      const mockPath = basePath.split(path.sep).join("/");

      // Create relative path from output file to input file
      const outputDir = path.dirname(outputFile);
      const relativeImportPath = path.relative(outputDir, fullPath).split(path.sep).join("/");
      const normalizedImportPath = relativeImportPath.startsWith(".") ? relativeImportPath : `./${relativeImportPath}`;

      const key = mockPath ? `/${mockPath}/${method}` : `/${method}`;
      result[key] = `import('${normalizedImportPath}')`;
    }
  });

  return result;
}

function parseArgs(): { folder: string; output: string } {
  const { values } = parseNodeArgs({
    options: {
      folder: { type: "string" },
      output: { type: "string" },
    },
    strict: false,
  });

  // npm scripts on Windows pass quotes through to the process, so strip surrounding quotes
  const stripQuotes = (value: unknown) =>
    typeof value === "string" ? value.replace(/^['"]|['"]$/g, "") : undefined;
  const folder = stripQuotes(values.folder);
  const output = stripQuotes(values.output);

  if (!folder || !output) {
    console.error("Usage: generate-mocks --folder=<input-folder> --output=<output-file>");
    process.exit(1);
  }

  return { folder, output };
}

function main() {
  const { folder, output } = parseArgs();

  // Ensure the input folder exists
  if (!fs.existsSync(folder)) {
    console.error(`Input folder "${folder}" does not exist`);
    process.exit(1);
  }

  // Create output directory if it doesn't exist
  const outputDir = path.dirname(output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const mocks = scanDirectory(folder, "", output);

  // Generate the output string, sorted by key for stable diffs
  const outputContent = `const mocks = {
${Object.entries(mocks)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => `  '${key}': ${value},`)
  .join("\n")}
} as const;

export default mocks;
`;

  // Write to the specified output file
  fs.writeFileSync(output, outputContent);
  console.log(`Generated mocks file created successfully at ${output}!`);
}

main();
