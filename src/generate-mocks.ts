import fs from "node:fs";
import path from "node:path";
import type { Dirent } from "node:fs";

interface MockEntries {
  [key: string]: string;
}

function scanDirectory(dir: string, basePath: string = "", inputFolder: string, outputFile: string): MockEntries {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result: MockEntries = {};

  entries.forEach((entry: Dirent) => {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      Object.assign(result, scanDirectory(fullPath, relativePath, inputFolder, outputFile));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      const dirPath = path.dirname(relativePath);
      const method = entry.name.replace(".json", "");
      // Remove the input folder path from the mock path to get the clean API path
      const mockPath = dirPath.replace(inputFolder, "").replace(/^[\/\\]/, "");

      // Create relative path from output file to input file
      const outputDir = path.dirname(outputFile);
      const relativeImportPath = path.relative(outputDir, fullPath);
      // Convert to forward slashes for imports and ensure it starts with ./
      const normalizedImportPath = "./" + relativeImportPath.replace(/\\/g, "/");

      result[`/${mockPath}/${method}`] = `import('${normalizedImportPath}')`;
    }
  });

  return result;
}

function parseArgs(): { folder: string; output: string } {
  const args = process.argv.slice(2);
  const folder = args
    .find((arg) => arg.startsWith("--folder="))
    ?.split("=")[1]
    ?.replace(/['"]/g, "");
  const output = args
    .find((arg) => arg.startsWith("--output="))
    ?.split("=")[1]
    ?.replace(/['"]/g, "");

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

  const mocks = scanDirectory(folder, "", folder, output);

  // Generate the output string
  const outputContent = `const mocks = {
${Object.entries(mocks)
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
