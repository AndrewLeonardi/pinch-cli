import chalk from "chalk";
import { readFile, writeFile, readdir } from "fs/promises";
import { resolve, join, relative } from "path";
import { existsSync } from "fs";
import { spawn } from "child_process";
import { select, confirm, input } from "@inquirer/prompts";
import {
  loadConfig,
  loadManifest,
  getApiKey,
  getPlatformUrl,
  saveConfig,
  type DeployTarget,
  type PinchConfig,
} from "../lib/config.js";
import {
  generateWorkerEntry,
  generateWranglerConfig,
  detectStorageUsage,
  detectD1Usage,
} from "../lib/worker-gen.js";

// ── Shell helper ────────────────────────────────────────

async function runCommand(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((res) => {
    const child = spawn(cmd, args, {
      cwd: opts?.cwd || process.cwd(),
      env: { ...process.env, ...(opts?.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));

    child.on("close", (code) => res({ stdout, stderr, code: code || 0 }));
    child.on("error", (err) =>
      res({ stdout, stderr: stderr || err.message, code: 1 })
    );
  });
}

// ── File bundlers ───────────────────────────────────────

async function bundleUIDirectory(): Promise<Record<string, string> | null> {
  const uiDir = resolve(process.cwd(), "ui");
  if (!existsSync(uiDir)) return null;

  const files: Record<string, string> = {};

  async function readDirRecursive(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
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

async function bundleServerFiles(): Promise<Record<string, string> | null> {
  const srcDir = resolve(process.cwd(), "src");
  if (!existsSync(srcDir)) return null;

  const files: Record<string, string> = {};

  async function readDirRecursive(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        await readDirRecursive(fullPath);
      } else if (
        entry.isFile() &&
        entry.name !== "index.ts" &&
        entry.name !== "_worker.ts"
      ) {
        const relPath = relative(srcDir, fullPath);
        files[relPath] = await readFile(fullPath, "utf-8");
      }
    }
  }

  await readDirRecursive(srcDir);
  return Object.keys(files).length > 0 ? files : null;
}

// ── Deploy to Cloudflare Workers ─────────────────────────

async function deployCloudflare(
  config: PinchConfig,
  options?: { setup?: boolean }
) {
  console.log(chalk.cyan("\n  ☁️  Deploying to Cloudflare Workers...\n"));

  const manifest = await loadManifest();
  if (!manifest) {
    console.log(chalk.red("  No pinch.toml found. Run `pinch init` first.\n"));
    process.exit(1);
  }

  // ── Step 1: Check credentials ──────────────────────────

  let cfToken = process.env.CLOUDFLARE_API_TOKEN || config.cf_api_token;
  let cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || config.cf_account_id;

  if (options?.setup || !cfToken || !cfAccountId) {
    if (!options?.setup) {
      console.log(chalk.yellow("  Cloudflare credentials needed.\n"));
    }
    console.log(
      chalk.dim(
        "  Get an API token: https://dash.cloudflare.com/profile/api-tokens"
      )
    );
    console.log(
      chalk.dim(
        "  Find your Account ID on the Workers & Pages overview page.\n"
      )
    );

    cfToken = await input({
      message: "Cloudflare API Token:",
      default: cfToken || undefined,
    });

    cfAccountId = await input({
      message: "Cloudflare Account ID:",
      default: cfAccountId || undefined,
    });

    if (!cfToken || !cfAccountId) {
      console.log(chalk.red("\n  Both API Token and Account ID are required.\n"));
      process.exit(1);
    }

    const shouldSave = await confirm({
      message: "Save credentials to ~/.pinchrc for future deploys?",
      default: true,
    });

    if (shouldSave) {
      config.cf_api_token = cfToken;
      config.cf_account_id = cfAccountId;
      await saveConfig(config);
      console.log(chalk.green("  ✓ Credentials saved\n"));
    }
  }

  const tool = manifest.tool;
  const slug = manifest.deploy?.worker_name || tool.slug;

  // ── Step 2: Read source + detect features ──────────────

  let toolsCode: string;
  try {
    toolsCode = await readFile(
      resolve(process.cwd(), "src/tools.ts"),
      "utf-8"
    );
  } catch {
    // Fallback for older projects that only have index.ts
    try {
      toolsCode = await readFile(
        resolve(process.cwd(), "src/index.ts"),
        "utf-8"
      );
    } catch {
      console.log(chalk.red("  Could not read src/tools.ts\n"));
      console.log(
        chalk.dim("  Make sure you're in a pinch project directory.\n")
      );
      process.exit(1);
    }
  }

  const usesStorage = detectStorageUsage(toolsCode);

  let schemaSql: string | null = null;
  try {
    schemaSql = await readFile(resolve(process.cwd(), "schema.sql"), "utf-8");
  } catch {
    // No schema — that's fine
  }

  const needsD1 = detectD1Usage(toolsCode) || schemaSql !== null;

  console.log(chalk.dim("  Worker:   ") + chalk.bold(slug));
  console.log(chalk.dim("  Source:   ") + "src/tools.ts");
  if (usesStorage) console.log(chalk.dim("  Storage:  ") + "Cloudflare KV");
  if (needsD1) console.log(chalk.dim("  Database: ") + "Cloudflare D1");
  console.log();

  // Env vars for all wrangler commands
  const wranglerEnv: Record<string, string> = {
    CLOUDFLARE_API_TOKEN: cfToken!,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId!,
  };

  // ── Step 3: Generate worker entry point ────────────────

  const workerCode = generateWorkerEntry({
    name: tool.name,
    version: tool.version,
    usesStorage,
    usesD1: needsD1,
  });

  await writeFile(resolve(process.cwd(), "src/_worker.ts"), workerCode);
  console.log(chalk.green("  ✓ Generated src/_worker.ts"));

  // ── Step 4: Provision cloud resources ──────────────────

  let kvId: string | null = null;
  let d1Id: string | null = null;

  // Read existing wrangler.toml to check for already-provisioned resources
  let existingWrangler = "";
  const wranglerPath = resolve(process.cwd(), "wrangler.toml");
  try {
    existingWrangler = await readFile(wranglerPath, "utf-8");
  } catch {}

  // ── KV namespace
  if (usesStorage) {
    // Check if KV ID is already set in wrangler.toml
    const kvMatch = existingWrangler.match(
      /binding\s*=\s*"TOOL_KV"[\s\S]*?id\s*=\s*"([^"]+)"/
    );
    if (kvMatch && kvMatch[1]) {
      kvId = kvMatch[1];
      console.log(chalk.dim("  • KV namespace: ") + chalk.dim(kvId));
    } else {
      console.log(chalk.dim("  Creating KV namespace..."));

      const result = await runCommand(
        "npx",
        ["wrangler", "kv", "namespace", "create", "TOOL_KV"],
        { env: wranglerEnv }
      );

      const allOutput = result.stdout + "\n" + result.stderr;
      const idMatch = allOutput.match(/id\s*=\s*"([a-f0-9]+)"/);

      if (idMatch && idMatch[1]) {
        kvId = idMatch[1];
        console.log(chalk.green("  ✓ KV namespace created"));
      } else if (result.code !== 0) {
        console.log(chalk.yellow("  ⚠ Could not create KV namespace"));
        console.log(
          chalk.dim(
            "    " + (result.stderr || result.stdout).trim().split("\n")[0]
          )
        );
        console.log(
          chalk.dim(
            "    You can create it manually: npx wrangler kv namespace create TOOL_KV"
          )
        );
      }
    }
  }

  // ── D1 database
  if (needsD1) {
    const dbName = `${slug}-db`;
    const d1Match = existingWrangler.match(
      /database_id\s*=\s*"([a-f0-9-]+)"/
    );
    if (d1Match && d1Match[1]) {
      d1Id = d1Match[1];
      console.log(chalk.dim("  • D1 database: ") + chalk.dim(dbName));
    } else {
      console.log(chalk.dim("  Creating D1 database..."));

      const result = await runCommand(
        "npx",
        ["wrangler", "d1", "create", dbName],
        { env: wranglerEnv }
      );

      const allOutput = result.stdout + "\n" + result.stderr;
      const idMatch = allOutput.match(
        /database_id\s*=\s*"([a-f0-9-]+)"/
      );

      if (idMatch && idMatch[1]) {
        d1Id = idMatch[1];
        console.log(chalk.green("  ✓ D1 database created"));
      } else if (result.code !== 0) {
        // Might already exist — try to find it
        const listResult = await runCommand(
          "npx",
          ["wrangler", "d1", "list", "--json"],
          { env: wranglerEnv }
        );
        try {
          const dbs = JSON.parse(listResult.stdout);
          const existing = dbs.find(
            (db: { name: string; uuid: string }) => db.name === dbName
          );
          if (existing) {
            d1Id = existing.uuid;
            console.log(
              chalk.green("  ✓ D1 database found (already exists)")
            );
          }
        } catch {
          console.log(chalk.yellow("  ⚠ Could not create D1 database"));
          console.log(
            chalk.dim(
              "    You can create it manually: npx wrangler d1 create " +
                dbName
            )
          );
        }
      }
    }
  }

  // ── Step 5: Write wrangler.toml with resource IDs ──────

  const newWranglerToml = generateWranglerConfig(slug, tool.name, {
    usesStorage,
    usesD1: needsD1,
    ...(kvId ? { kvId } : {}),
    ...(d1Id ? { d1DatabaseId: d1Id } : {}),
  });
  await writeFile(wranglerPath, newWranglerToml);
  console.log(chalk.green("  ✓ wrangler.toml updated"));

  // ── Step 6: Run D1 migration if schema.sql exists ──────

  if (schemaSql && d1Id) {
    console.log(chalk.dim("  Running database migration..."));

    const migResult = await runCommand(
      "npx",
      [
        "wrangler",
        "d1",
        "execute",
        `${slug}-db`,
        "--file=schema.sql",
        "--remote",
      ],
      { env: wranglerEnv }
    );

    if (migResult.code === 0) {
      console.log(chalk.green("  ✓ Database migration applied"));
    } else {
      console.log(chalk.yellow("  ⚠ Migration warning:"));
      const errLine = (migResult.stderr || migResult.stdout)
        .trim()
        .split("\n")[0];
      console.log(chalk.dim("    " + errLine));
      console.log(
        chalk.dim("    Tables may already exist (safe to ignore)")
      );
    }
  }

  // ── Step 7: Deploy with wrangler ───────────────────────

  console.log(chalk.dim("\n  Deploying to Cloudflare Workers..."));

  const deployResult = await runCommand("npx", ["wrangler", "deploy"], {
    env: wranglerEnv,
  });

  if (deployResult.code !== 0) {
    console.log(chalk.red("\n  ✗ Deployment failed\n"));
    const errorLines = (deployResult.stderr || deployResult.stdout)
      .trim()
      .split("\n")
      .slice(0, 12);
    for (const line of errorLines) {
      console.log(chalk.dim("    " + line));
    }
    console.log();
    console.log("  " + chalk.bold("Troubleshooting:"));
    console.log(
      chalk.dim("    • Ensure your API token has Workers edit permission")
    );
    console.log(chalk.dim("    • Verify your Account ID is correct"));
    console.log(
      chalk.dim("    • Try running: npx wrangler deploy --dry-run")
    );
    console.log(
      chalk.dim("    • Re-run setup: pinch deploy cloudflare --setup\n")
    );
    process.exit(1);
  }

  // ── Step 8: Print results ──────────────────────────────

  const allOutput = deployResult.stdout + "\n" + deployResult.stderr;
  const urlMatch = allOutput.match(/https:\/\/[^\s]+\.workers\.dev/);
  const liveUrl = urlMatch
    ? urlMatch[0]
    : `https://${slug}.workers.dev`;

  console.log(chalk.green("\n  ✓ Deployed successfully!\n"));
  console.log(
    `  ${chalk.bold("Live URL:")}      ${chalk.cyan(liveUrl)}`
  );
  console.log(
    `  ${chalk.bold("MCP endpoint:")}  ${chalk.cyan(liveUrl + "/mcp")}`
  );
  console.log();
  console.log(chalk.dim("  Connect from any AI client:"));
  console.log(chalk.dim(`    ${liveUrl}/mcp`));
  console.log();
}

// ── Deploy to Docker ─────────────────────────────────────

async function deployDocker() {
  console.log(chalk.cyan("\n  🐳 Generating Docker deployment files...\n"));

  const manifest = await loadManifest();
  if (!manifest) {
    console.log(chalk.red("  No pinch.toml found. Run `pinch init` first.\n"));
    process.exit(1);
  }

  const tool = manifest.tool;
  const imageName = manifest.deploy?.image_name || tool.slug;

  // Generate Dockerfile
  const dockerfile = `# ${tool.name} — MCP Server
# Generated by pinch CLI (https://github.com/AndrewLeonardi/pinch-cli)

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ui ./ui 2>/dev/null || true
COPY --from=builder /app/public ./public 2>/dev/null || true

ENV PORT=3100
EXPOSE 3100

CMD ["node", "dist/index.js"]
`;

  const dockerignore = `node_modules
dist
.git
.env
.pinch-data.json
.pinchers-data.json
src/_worker.ts
.wrangler/
`;

  const composefile = `# Docker Compose for ${tool.name}
# Run with: docker compose up

services:
  ${tool.slug}:
    build: .
    ports:
      - "3100:3100"
    environment:
      - PORT=3100
    restart: unless-stopped
`;

  const dockerfilePath = resolve(process.cwd(), "Dockerfile");
  const dockerignorePath = resolve(process.cwd(), ".dockerignore");
  const composePath = resolve(process.cwd(), "docker-compose.yml");

  if (!existsSync(dockerfilePath)) {
    await writeFile(dockerfilePath, dockerfile);
    console.log(chalk.green("  ✓ Generated Dockerfile"));
  } else {
    console.log(chalk.dim("  • Dockerfile already exists (skipped)"));
  }

  if (!existsSync(dockerignorePath)) {
    await writeFile(dockerignorePath, dockerignore);
    console.log(chalk.green("  ✓ Generated .dockerignore"));
  }

  if (!existsSync(composePath)) {
    await writeFile(composePath, composefile);
    console.log(chalk.green("  ✓ Generated docker-compose.yml"));
  } else {
    console.log(chalk.dim("  • docker-compose.yml already exists (skipped)"));
  }

  console.log(chalk.green(`\n  ✓ Docker deployment ready!\n`));
  console.log("  Build and run:");
  console.log(`    ${chalk.cyan(`docker build -t ${imageName} .`)}`);
  console.log(`    ${chalk.cyan(`docker run -p 3100:3100 ${imageName}`)}`);
  console.log();
  console.log("  Or with Docker Compose:");
  console.log(`    ${chalk.cyan("docker compose up")}`);
  console.log();
  console.log("  Your MCP server will be available at:");
  console.log(`    ${chalk.cyan("http://localhost:3100/mcp")}`);
  console.log();
}

// ── Deploy to Pinchers.ai Marketplace ────────────────────

async function deployPinchers(config: PinchConfig) {
  console.log(
    chalk.hex("#e8503a")("\n  🦞 Publishing to Pinchers.ai Marketplace...\n")
  );

  const apiKey = getApiKey(config);
  if (!apiKey) {
    console.log(chalk.red("  Not logged in to Pinchers.ai."));
    console.log(
      "  Run " + chalk.cyan("pinch login") + " first, then try again.\n"
    );
    process.exit(1);
  }

  const manifest = await loadManifest();
  if (!manifest) {
    console.log(chalk.red("  No pinch.toml found. Run `pinch init` first.\n"));
    process.exit(1);
  }

  const tool = manifest.tool;
  console.log(
    chalk.dim("  Publishing: ") +
      chalk.bold(tool.name) +
      chalk.dim(` v${tool.version}`)
  );
  console.log(chalk.dim("  Slug: ") + tool.slug);
  console.log(chalk.dim("  Category: ") + tool.category);
  console.log();

  // Read source — prefer tools.ts (new structure), fallback to index.ts (legacy)
  let sourceCode: string;
  try {
    sourceCode = await readFile(
      resolve(process.cwd(), "src/index.ts"),
      "utf-8"
    );
  } catch {
    try {
      sourceCode = await readFile(
        resolve(process.cwd(), "src/tools.ts"),
        "utf-8"
      );
    } catch {
      console.log(chalk.red("  Could not read src/index.ts or src/tools.ts\n"));
      process.exit(1);
    }
  }

  // Read README
  let readmeMd = "";
  try {
    readmeMd = await readFile(resolve(process.cwd(), "README.md"), "utf-8");
  } catch {
    // Optional
  }

  // Read schema
  let schemaSql: string | null = null;
  try {
    schemaSql = await readFile(resolve(process.cwd(), "schema.sql"), "utf-8");
  } catch {}

  // Bundle files
  const uiFiles = await bundleUIDirectory();
  const serverFiles = await bundleServerFiles();

  if (uiFiles) {
    const count = Object.keys(uiFiles).length;
    console.log(
      chalk.cyan("  ✦ Custom UI: ") +
        chalk.dim(`${count} file${count > 1 ? "s" : ""} in ui/`)
    );
  }
  if (serverFiles) {
    const count = Object.keys(serverFiles).length;
    console.log(
      chalk.cyan("  ✦ Server modules: ") +
        chalk.dim(`${count} file${count > 1 ? "s" : ""} in src/`)
    );
  }
  if (schemaSql) {
    console.log(chalk.cyan("  ✦ Database: ") + chalk.dim("schema.sql"));
  }
  console.log();

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
        ...(serverFiles ? { server_files: serverFiles } : {}),
        ...(schemaSql ? { schema_sql: schemaSql } : {}),
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as { slug: string; status: string };
      console.log(chalk.green("  ✓ Submitted to Pinchers.ai!"));
      console.log(chalk.dim(`  Status: ${json.status}`));
      console.log(
        chalk.dim(
          `  Track at: ${platformUrl}/dashboard/creator/${json.slug}\n`
        )
      );
    } else {
      const err = (await res.json()) as { error: string };
      console.log(chalk.red(`  Publish failed: ${err.error}\n`));
      process.exit(1);
    }
  } catch {
    console.log(
      chalk.red(
        "  Could not reach Pinchers.ai. Check your internet connection.\n"
      )
    );
    process.exit(1);
  }
}

// ── Main Deploy Command ──────────────────────────────────

export async function deployCommand(
  targetArg?: string,
  options?: { setup?: boolean }
) {
  console.log(
    chalk.bold("\n  ⚡ pinch deploy") +
      chalk.dim(" — ship your MCP server to the world\n")
  );

  const manifest = await loadManifest();
  if (!manifest) {
    console.log(chalk.red("  No pinch.toml found in this directory."));
    console.log(
      "  Run " + chalk.cyan("pinch init") + " to scaffold a new MCP server.\n"
    );
    process.exit(1);
  }

  let target: DeployTarget;

  if (targetArg) {
    // Validate target
    const validTargets: DeployTarget[] = ["cloudflare", "docker", "pinchers"];
    if (!validTargets.includes(targetArg as DeployTarget)) {
      console.log(chalk.red(`  Unknown target: ${targetArg}`));
      console.log("  Available targets: " + validTargets.join(", ") + "\n");
      process.exit(1);
    }
    target = targetArg as DeployTarget;
  } else {
    // Interactive selection — Cloudflare is the recommended default
    target = await select({
      message: "Where do you want to deploy?",
      choices: [
        {
          value: "cloudflare" as DeployTarget,
          name: "☁️  Cloudflare Workers — Edge deployment, global CDN, free tier (recommended)",
        },
        {
          value: "docker" as DeployTarget,
          name: "🐳 Docker — Self-host anywhere (AWS, GCP, your own server)",
        },
        {
          value: "pinchers" as DeployTarget,
          name: "🦞 Pinchers.ai — Marketplace with built-in monetization + users",
        },
      ],
    });
  }

  const config = await loadConfig();

  switch (target) {
    case "cloudflare":
      await deployCloudflare(config, options);
      break;
    case "docker":
      await deployDocker();
      break;
    case "pinchers":
      await deployPinchers(config);
      break;
  }
}
