import chalk from "chalk";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import { resolve, join, relative } from "path";
import { existsSync } from "fs";
import { select, confirm } from "@inquirer/prompts";
import {
  loadConfig,
  loadManifest,
  getApiKey,
  getPlatformUrl,
  saveConfig,
  type DeployTarget,
  type PinchConfig,
} from "../lib/config.js";

// ── Helpers ──────────────────────────────────────────────

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
      } else if (entry.isFile() && entry.name !== "index.ts") {
        const relPath = relative(srcDir, fullPath);
        files[relPath] = await readFile(fullPath, "utf-8");
      }
    }
  }

  await readDirRecursive(srcDir);
  return Object.keys(files).length > 0 ? files : null;
}

// ── Deploy to Cloudflare Workers ─────────────────────────

async function deployCloudflare(config: PinchConfig) {
  console.log(chalk.cyan("\n  ☁️  Deploying to Cloudflare Workers...\n"));

  const manifest = await loadManifest();
  if (!manifest) {
    console.log(chalk.red("  No pinch.toml found. Run `pinch init` first.\n"));
    process.exit(1);
  }

  // Check for Cloudflare credentials
  let cfToken = config.cf_api_token || process.env.CLOUDFLARE_API_TOKEN;
  let cfAccountId = config.cf_account_id || process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!cfToken || !cfAccountId) {
    console.log(chalk.yellow("  Cloudflare credentials not found.\n"));
    console.log("  To deploy to Cloudflare Workers, you need:");
    console.log("    1. A Cloudflare account (free at " + chalk.cyan("https://cloudflare.com") + ")");
    console.log("    2. An API token with Workers permissions");
    console.log("    3. Your Account ID (found in the dashboard URL)\n");
    console.log("  Set them as environment variables:");
    console.log(chalk.dim("    export CLOUDFLARE_API_TOKEN=your_token"));
    console.log(chalk.dim("    export CLOUDFLARE_ACCOUNT_ID=your_account_id\n"));
    console.log("  Or save them with: " + chalk.cyan("pinch deploy cloudflare --setup") + "\n");
    process.exit(1);
  }

  const tool = manifest.tool;
  const workerName = manifest.deploy?.worker_name || tool.slug;

  // Read source
  let sourceCode: string;
  try {
    sourceCode = await readFile(resolve(process.cwd(), "src/index.ts"), "utf-8");
  } catch {
    console.log(chalk.red("  Could not read src/index.ts\n"));
    process.exit(1);
  }

  // Read schema if exists
  let schemaSql: string | null = null;
  try {
    schemaSql = await readFile(resolve(process.cwd(), "schema.sql"), "utf-8");
  } catch {
    // No schema — that's fine
  }

  // Bundle additional server files
  const serverFiles = await bundleServerFiles();

  console.log(chalk.dim("  Worker: ") + chalk.bold(workerName));
  console.log(chalk.dim("  Source: ") + "src/index.ts" + (serverFiles ? ` + ${Object.keys(serverFiles).length} modules` : ""));
  if (schemaSql) console.log(chalk.dim("  Database: ") + "schema.sql (D1)");
  console.log();

  // TODO: Direct Cloudflare API deployment
  // For now, generate a wrangler.toml and instruct user
  const wranglerConfig = generateWranglerToml(workerName, tool.name, schemaSql !== null);
  const wranglerPath = resolve(process.cwd(), "wrangler.toml");

  if (!existsSync(wranglerPath)) {
    await writeFile(wranglerPath, wranglerConfig);
    console.log(chalk.green("  ✓ Generated wrangler.toml"));
  }

  console.log(chalk.green("  ✓ Ready for Cloudflare deployment!\n"));
  console.log("  Next steps:");
  console.log(`    ${chalk.cyan("npx wrangler deploy")}  — deploy to Cloudflare Workers`);
  if (schemaSql) {
    console.log(`    ${chalk.cyan("npx wrangler d1 execute DB --file=schema.sql")}  — initialize database`);
  }
  console.log();
}

function generateWranglerToml(name: string, displayName: string, hasD1: boolean): string {
  let config = `# ${displayName} — MCP Server on Cloudflare Workers
# Generated by pinch CLI (https://github.com/AndrewLeonardi/pinch-cli)

name = "${name}"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[durable_objects]
bindings = [
  { name = "MCP_AGENT", class_name = "ToolMCP" }
]

[[migrations]]
tag = "v1"
new_classes = ["ToolMCP"]
`;

  if (hasD1) {
    config += `
[[d1_databases]]
binding = "DB"
database_name = "${name}-db"
database_id = "" # Run: npx wrangler d1 create ${name}-db
`;
  }

  return config;
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

  let filesCreated = 0;

  if (!existsSync(dockerfilePath)) {
    await writeFile(dockerfilePath, dockerfile);
    filesCreated++;
    console.log(chalk.green("  ✓ Generated Dockerfile"));
  } else {
    console.log(chalk.dim("  • Dockerfile already exists (skipped)"));
  }

  if (!existsSync(dockerignorePath)) {
    await writeFile(dockerignorePath, dockerignore);
    filesCreated++;
    console.log(chalk.green("  ✓ Generated .dockerignore"));
  }

  if (!existsSync(composePath)) {
    await writeFile(composePath, composefile);
    filesCreated++;
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
  console.log(chalk.hex("#e8503a")("\n  🦞 Publishing to Pinchers.ai Marketplace...\n"));

  const apiKey = getApiKey(config);
  if (!apiKey) {
    console.log(chalk.red("  Not logged in to Pinchers.ai."));
    console.log("  Run " + chalk.cyan("pinch login") + " first, then try again.\n");
    process.exit(1);
  }

  const manifest = await loadManifest();
  if (!manifest) {
    console.log(chalk.red("  No pinch.toml found. Run `pinch init` first.\n"));
    process.exit(1);
  }

  const tool = manifest.tool;
  console.log(chalk.dim("  Publishing: ") + chalk.bold(tool.name) + chalk.dim(` v${tool.version}`));
  console.log(chalk.dim("  Slug: ") + tool.slug);
  console.log(chalk.dim("  Category: ") + tool.category);
  console.log();

  // Read source
  let sourceCode: string;
  try {
    sourceCode = await readFile(resolve(process.cwd(), "src/index.ts"), "utf-8");
  } catch {
    console.log(chalk.red("  Could not read src/index.ts\n"));
    process.exit(1);
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
    console.log(chalk.cyan("  ✦ Custom UI: ") + chalk.dim(`${count} file${count > 1 ? "s" : ""} in ui/`));
  }
  if (serverFiles) {
    const count = Object.keys(serverFiles).length;
    console.log(chalk.cyan("  ✦ Server modules: ") + chalk.dim(`${count} file${count > 1 ? "s" : ""} in src/`));
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
      console.log(chalk.dim(`  Track at: ${platformUrl}/dashboard/creator/${json.slug}\n`));
    } else {
      const err = (await res.json()) as { error: string };
      console.log(chalk.red(`  Publish failed: ${err.error}\n`));
      process.exit(1);
    }
  } catch {
    console.log(chalk.red("  Could not reach Pinchers.ai. Check your internet connection.\n"));
    process.exit(1);
  }
}

// ── Main Deploy Command ──────────────────────────────────

export async function deployCommand(targetArg?: string, options?: { setup?: boolean }) {
  console.log(chalk.bold("\n  ⚡ pinch deploy") + chalk.dim(" — ship your MCP server to the world\n"));

  const manifest = await loadManifest();
  if (!manifest) {
    console.log(chalk.red("  No pinch.toml found in this directory."));
    console.log("  Run " + chalk.cyan("pinch init") + " to scaffold a new MCP server.\n");
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
    // Interactive selection
    target = await select({
      message: "Where do you want to deploy?",
      choices: [
        {
          value: "cloudflare" as DeployTarget,
          name: "☁️  Cloudflare Workers — Edge deployment, global CDN, free tier",
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
      await deployCloudflare(config);
      break;
    case "docker":
      await deployDocker();
      break;
    case "pinchers":
      await deployPinchers(config);
      break;
  }
}
