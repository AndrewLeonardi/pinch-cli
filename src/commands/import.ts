import { resolve } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname } from "path";
import chalk from "chalk";
import { input as promptInput } from "@inquirer/prompts";
import {
  validatePackage,
  slugify,
  packageToManifest,
  type ToolPackage,
} from "../lib/package-format.js";
import { generateDevServer, getPackageJson, getTsConfig, getGitignore, getEnvExample } from "../templates/server-runtime.js";
import { getPlaygroundHtml } from "../templates/index.js";
import { generateWranglerConfig } from "../lib/worker-gen.js";
import { spawn } from "child_process";

export async function importCommand(fileArg?: string) {
  console.log(
    chalk.bold("\n  pinch import") +
      chalk.dim(" — import a tool package from AI output\n")
  );

  let jsonStr: string;

  if (fileArg) {
    // Read from file
    const filePath = resolve(process.cwd(), fileArg);
    if (!existsSync(filePath)) {
      console.log(chalk.red(`  File not found: ${fileArg}\n`));
      process.exit(1);
    }
    jsonStr = await readFile(filePath, "utf-8");
    console.log(chalk.dim(`  Reading from ${fileArg}...`));
  } else {
    // Check if stdin has data (piped input)
    if (!process.stdin.isTTY) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      jsonStr = Buffer.concat(chunks).toString("utf-8");
      console.log(chalk.dim("  Reading from stdin..."));
    } else {
      // Interactive paste mode
      console.log(chalk.dim("  Paste your JSON tool package below."));
      console.log(chalk.dim("  Press Enter twice when done, or Ctrl+D to finish.\n"));

      jsonStr = await promptInput({
        message: "JSON package:",
      });
    }
  }

  // Parse JSON
  let data: unknown;
  try {
    // Handle case where the JSON is wrapped in markdown code blocks
    const cleaned = jsonStr
      .replace(/^```(?:json)?\s*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();
    data = JSON.parse(cleaned);
  } catch {
    console.log(chalk.red("  Invalid JSON. Make sure the package is valid JSON.\n"));
    console.log(chalk.dim("  Tip: If you copied from a chat, remove any markdown formatting (```json blocks).\n"));
    process.exit(1);
  }

  // Validate
  const validation = validatePackage(data);

  if (validation.warnings.length > 0) {
    for (const w of validation.warnings) {
      console.log(chalk.yellow(`  Warning: ${w}`));
    }
  }

  if (!validation.valid) {
    console.log(chalk.red("\n  Package validation failed:"));
    for (const e of validation.errors) {
      console.log(chalk.red(`    - ${e}`));
    }
    console.log();
    process.exit(1);
  }

  const pkg = data as ToolPackage;

  // Fill in defaults
  if (!pkg.slug) {
    pkg.slug = slugify(pkg.name);
  }
  if (!pkg.version) {
    pkg.version = "0.1.0";
  }
  if (!pkg.category) {
    pkg.category = "other";
  }

  const projectDir = resolve(process.cwd(), pkg.slug);

  if (existsSync(projectDir)) {
    console.log(chalk.red(`\n  Directory "${pkg.slug}" already exists.`));
    console.log(chalk.dim("  Choose a different name or delete the existing directory.\n"));
    process.exit(1);
  }

  console.log(chalk.bold(`\n  Creating project: ${pkg.name}`));
  console.log(chalk.dim(`  Directory: ${pkg.slug}/`));

  // Build file map
  const files: Record<string, string> = {};

  // Manifest
  files["pinch.toml"] = packageToManifest(pkg);

  // Source code
  files["src/tools.ts"] = pkg.source_code;

  // Dev server
  files["src/index.ts"] = generateDevServer(pkg.name);

  // UI files
  if (pkg.ui_files) {
    for (const [path, content] of Object.entries(pkg.ui_files)) {
      files[`ui/${path}`] = content;
    }
    console.log(chalk.cyan(`  UI files: ${Object.keys(pkg.ui_files).length}`));
  }

  // Server files
  if (pkg.server_files) {
    for (const [path, content] of Object.entries(pkg.server_files)) {
      files[`src/${path}`] = content;
    }
    console.log(chalk.cyan(`  Server modules: ${Object.keys(pkg.server_files).length}`));
  }

  // Schema
  if (pkg.schema_sql) {
    files["schema.sql"] = pkg.schema_sql;
    console.log(chalk.cyan("  Database schema: schema.sql"));
  }

  // Standard scaffolding
  files["wrangler.toml"] = generateWranglerConfig(pkg.slug, pkg.name);
  files["public/playground.html"] = getPlaygroundHtml(pkg.name, pkg.description || "");
  files["package.json"] = getPackageJson(pkg.slug, pkg.description || "");
  files["tsconfig.json"] = getTsConfig();
  files[".gitignore"] = getGitignore();
  files[".env.example"] = getEnvExample();

  // Write all files
  console.log();
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = resolve(projectDir, relPath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, content);
  }

  console.log(chalk.green(`  Created ${Object.keys(files).length} files`));

  // npm install
  console.log(chalk.dim("\n  Installing dependencies..."));
  await new Promise<void>((res) => {
    const child = spawn("npm", ["install"], {
      cwd: projectDir,
      stdio: "pipe",
    });
    child.on("close", () => res());
    child.on("error", () => res());
  });

  console.log(chalk.green("  Dependencies installed"));

  // Print next steps
  console.log(chalk.bold("\n  Done! Next steps:\n"));
  console.log(`    cd ${pkg.slug}`);
  console.log("    pinch dev      # start developing");
  console.log("    pinch test     # run tests");
  console.log("    pinch deploy   # ship it\n");
}
