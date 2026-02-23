import chalk from "chalk";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { loadConfig, loadManifest, getApiKey, getPlatformUrl } from "../lib/config.js";

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
