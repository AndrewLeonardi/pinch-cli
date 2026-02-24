import chalk from "chalk";
import { readFile, readdir, stat } from "fs/promises";
import { resolve, join, relative } from "path";
import { existsSync } from "fs";
import { loadConfig, loadManifest, getApiKey, getPlatformUrl } from "../lib/config.js";

async function bundleUIDirectory(): Promise<Record<string, string> | null> {
  const uiDir = resolve(process.cwd(), "ui");
  if (!existsSync(uiDir)) return null;

  const files: Record<string, string> = {};

  async function readDirRecursive(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await readDirRecursive(fullPath);
      } else if (entry.isFile()) {
        const relPath = relative(uiDir, fullPath);
        files[relPath] = await readFile(fullPath, "utf-8");
      }
    }
  }

  await readDirRecursive(uiDir);
  return Object.keys(files).length > 0 ? files : null;
}

export async function publishCommand() {
  console.log(chalk.red("🦞") + chalk.bold(" pinch publish") + " — submit to Pinchers.ai\n");

  // Check auth
  const config = await loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) {
    console.log(chalk.red("  Not logged in. Run `pinch login` first.\n"));
    process.exit(1);
  }

  // Check manifest
  const manifest = await loadManifest();
  if (!manifest) {
    console.log(chalk.red("  No pinchers.toml found. Run `pinch init` first.\n"));
    process.exit(1);
  }

  const tool = manifest.tool;
  console.log(chalk.dim("  Publishing: ") + chalk.bold(tool.name) + chalk.dim(` v${tool.version}`));
  console.log(chalk.dim("  Slug: ") + tool.slug);
  console.log(chalk.dim("  Category: ") + tool.category);
  console.log();

  // Read source files
  let sourceCode = "";
  try {
    sourceCode = await readFile(resolve(process.cwd(), "src/index.ts"), "utf-8");
  } catch {
    console.log(chalk.red("  Could not read src/index.ts\n"));
    process.exit(1);
  }

  let readmeMd = "";
  try {
    readmeMd = await readFile(resolve(process.cwd(), "README.md"), "utf-8");
  } catch {
    // README is optional
  }

  // Bundle custom UI files if present
  const uiFiles = await bundleUIDirectory();
  if (uiFiles) {
    const fileCount = Object.keys(uiFiles).length;
    console.log(chalk.cyan("  ✦ Custom UI: ") + chalk.dim(`${fileCount} file${fileCount > 1 ? "s" : ""} in ui/`));
    console.log();
  }

  const platformUrl = getPlatformUrl();

  try {
    const res = await fetch(`${platformUrl}/api/tools/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        manifest: tool,
        source_code: sourceCode,
        readme_md: readmeMd,
        ...(uiFiles ? { ui_files: uiFiles } : {}),
      }),
    });

    if (res.ok) {
      const json = await res.json() as { slug: string; status: string };
      console.log(chalk.green("  ✓ Submitted for review!"));
      console.log(chalk.dim(`  Status: ${json.status}`));
      console.log(chalk.dim(`  Track at: ${platformUrl}/dashboard/creator/${json.slug}\n`));
    } else {
      const err = await res.json() as { error: string };
      console.log(chalk.red(`  Publish failed: ${err.error}\n`));
      process.exit(1);
    }
  } catch {
    console.log(chalk.red("  Could not reach Pinchers.ai. Check your internet connection.\n"));
    process.exit(1);
  }
}
