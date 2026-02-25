import { resolve } from "path";
import { readFile, writeFile } from "fs/promises";
import chalk from "chalk";
import { loadManifest } from "../lib/config.js";
import { bundleUIDirectory, bundleServerFiles, readOptionalFile } from "../lib/bundle.js";
import type { ToolPackage } from "../lib/package-format.js";

export async function exportCommand(options: { output?: string }) {
  const manifest = await loadManifest();
  if (!manifest) {
    console.log(chalk.red("\n  No pinch.toml found. Run `pinch init` first.\n"));
    process.exit(1);
  }

  const tool = manifest.tool;

  // Read source code — prefer tools.ts, fallback to index.ts
  let sourceCode: string;
  try {
    sourceCode = await readFile(resolve(process.cwd(), "src/tools.ts"), "utf-8");
  } catch {
    try {
      sourceCode = await readFile(resolve(process.cwd(), "src/index.ts"), "utf-8");
    } catch {
      console.log(chalk.red("  Could not read src/tools.ts or src/index.ts\n"));
      process.exit(1);
    }
  }

  const pkg: ToolPackage = {
    name: tool.name,
    slug: tool.slug,
    description: tool.description || "",
    category: tool.category || "other",
    version: tool.version || "0.1.0",
    tags: tool.tags || [],
    source_code: sourceCode,
  };

  // UI files
  const uiFiles = await bundleUIDirectory();
  if (uiFiles) {
    pkg.ui_files = uiFiles;
  }

  // Server files
  const serverFiles = await bundleServerFiles();
  if (serverFiles) {
    pkg.server_files = serverFiles;
  }

  // Schema
  const schemaSql = await readOptionalFile("schema.sql");
  if (schemaSql) {
    pkg.schema_sql = schemaSql;
  }

  const json = JSON.stringify(pkg, null, 2);

  if (options.output) {
    await writeFile(resolve(process.cwd(), options.output), json);
    console.log(chalk.green(`\n  Exported to ${options.output}`));
    console.log(chalk.dim(`  ${Object.keys(pkg).filter(k => pkg[k as keyof ToolPackage]).length} fields, ${json.length} bytes\n`));
  } else {
    // Print to stdout (for piping)
    process.stdout.write(json + "\n");
  }
}
