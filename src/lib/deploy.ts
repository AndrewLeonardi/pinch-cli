/**
 * Deployment logic for Cloudflare Workers and Pinchers.ai.
 * Non-interactive — credentials and progress come from the web UI.
 */

import { readFile, writeFile, readdir } from "fs/promises";
import { resolve, join, relative } from "path";
import { existsSync } from "fs";
import { spawn } from "child_process";
import {
  generateWorkerEntry,
  generateWranglerConfig,
  detectStorageUsage,
  detectD1Usage,
} from "./worker-gen.js";
import { getPlatformUrl, loadConfig } from "./config.js";

// ── Shell helper ─────────────────────────────────────────

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

// ── File bundling (inlined from bundle.ts) ───────────────

async function readDirRecursive(
  dir: string,
  baseDir: string,
  skipNames: string[] = []
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      const nested = await readDirRecursive(fullPath, baseDir, skipNames);
      Object.assign(files, nested);
    } else if (entry.isFile() && !skipNames.includes(entry.name)) {
      const relPath = relative(baseDir, fullPath);
      files[relPath] = await readFile(fullPath, "utf-8");
    }
  }

  return files;
}

async function readOptionalFile(dir: string, path: string): Promise<string | null> {
  try {
    return await readFile(resolve(dir, path), "utf-8");
  } catch {
    return null;
  }
}

// ── Cloudflare Workers Deploy ────────────────────────────

interface CloudflareDeployOpts {
  projectDir: string;
  cfToken: string;
  cfAccountId: string;
  onProgress: (stage: string, message: string) => void;
}

export async function deployToCloudflare(opts: CloudflareDeployOpts): Promise<{ url: string }> {
  const { projectDir, cfToken, cfAccountId, onProgress } = opts;

  // Read pinch.toml for name/slug
  const tomlRaw = await readFile(resolve(projectDir, "pinch.toml"), "utf-8");
  const nameMatch = tomlRaw.match(/^name\s*=\s*"(.+)"/m);
  const slugMatch = tomlRaw.match(/^slug\s*=\s*"(.+)"/m);
  const name = nameMatch?.[1] || "my-tool";
  const slug = slugMatch?.[1] || "my-tool";

  // Read source code
  onProgress("reading", "Reading source code...");
  let toolsCode: string;
  try {
    toolsCode = await readFile(resolve(projectDir, "src/tools.ts"), "utf-8");
  } catch {
    toolsCode = await readFile(resolve(projectDir, "src/index.ts"), "utf-8");
  }

  const usesStorage = detectStorageUsage(toolsCode);
  const schemaSql = await readOptionalFile(projectDir, "schema.sql");
  const needsD1 = detectD1Usage(toolsCode) || schemaSql !== null;

  const wranglerEnv = {
    CLOUDFLARE_API_TOKEN: cfToken,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId,
  };

  // Generate worker entry
  onProgress("generating", "Generating worker code...");
  const workerCode = generateWorkerEntry({ name, version: "0.1.0", usesStorage, usesD1: needsD1 });
  await writeFile(resolve(projectDir, "src/_worker.ts"), workerCode);

  // Provision resources
  let kvId: string | null = null;
  let d1Id: string | null = null;

  const existingWrangler = await readOptionalFile(projectDir, "wrangler.toml") || "";

  if (usesStorage) {
    onProgress("provisioning", "Creating KV namespace...");
    const kvMatch = existingWrangler.match(/binding\s*=\s*"TOOL_KV"[\s\S]*?id\s*=\s*"([^"]+)"/);
    if (kvMatch?.[1]) {
      kvId = kvMatch[1];
    } else {
      const result = await runCommand("npx", ["wrangler", "kv", "namespace", "create", "TOOL_KV"], { cwd: projectDir, env: wranglerEnv });
      const idMatch = (result.stdout + "\n" + result.stderr).match(/id\s*=\s*"([a-f0-9]+)"/);
      if (idMatch?.[1]) kvId = idMatch[1];
    }
  }

  if (needsD1) {
    onProgress("provisioning", "Creating D1 database...");
    const dbName = `${slug}-db`;
    const d1Match = existingWrangler.match(/database_id\s*=\s*"([a-f0-9-]+)"/);
    if (d1Match?.[1]) {
      d1Id = d1Match[1];
    } else {
      const result = await runCommand("npx", ["wrangler", "d1", "create", dbName], { cwd: projectDir, env: wranglerEnv });
      const idMatch = (result.stdout + "\n" + result.stderr).match(/database_id\s*=\s*"([a-f0-9-]+)"/);
      if (idMatch?.[1]) {
        d1Id = idMatch[1];
      } else {
        // Try to find existing
        const listResult = await runCommand("npx", ["wrangler", "d1", "list", "--json"], { cwd: projectDir, env: wranglerEnv });
        try {
          const dbs = JSON.parse(listResult.stdout);
          const existing = dbs.find((db: { name: string; uuid: string }) => db.name === dbName);
          if (existing) d1Id = existing.uuid;
        } catch {}
      }
    }
  }

  // Write wrangler.toml
  onProgress("configuring", "Writing wrangler.toml...");
  const newWrangler = generateWranglerConfig(slug, name, {
    usesStorage,
    usesD1: needsD1,
    ...(kvId ? { kvId } : {}),
    ...(d1Id ? { d1DatabaseId: d1Id } : {}),
  });
  await writeFile(resolve(projectDir, "wrangler.toml"), newWrangler);

  // D1 migration
  if (schemaSql && d1Id) {
    onProgress("migrating", "Running database migration...");
    await runCommand("npx", ["wrangler", "d1", "execute", `${slug}-db`, "--file=schema.sql", "--remote"], { cwd: projectDir, env: wranglerEnv });
  }

  // Deploy
  onProgress("deploying", "Deploying to Cloudflare Workers...");
  const deployResult = await runCommand("npx", ["wrangler", "deploy"], { cwd: projectDir, env: wranglerEnv });

  if (deployResult.code !== 0) {
    const errorLine = (deployResult.stderr || deployResult.stdout).trim().split("\n")[0];
    throw new Error("Deploy failed: " + errorLine);
  }

  const allOutput = deployResult.stdout + "\n" + deployResult.stderr;
  const urlMatch = allOutput.match(/https:\/\/[^\s]+\.workers\.dev/);
  const liveUrl = urlMatch ? urlMatch[0] : `https://${slug}.workers.dev`;

  return { url: liveUrl };
}

// ── Pinchers.ai Deploy ───────────────────────────────────

interface PinchersDeployOpts {
  projectDir: string;
  apiKey: string;
  onProgress: (stage: string, message: string) => void;
}

export async function deployToPinchers(opts: PinchersDeployOpts): Promise<{ url: string; mcpUrl: string; slug: string }> {
  const { projectDir, apiKey, onProgress } = opts;

  // Read manifest
  onProgress("reading", "Reading project...");
  const tomlRaw = await readFile(resolve(projectDir, "pinch.toml"), "utf-8");

  // Simple TOML parsing for the fields we need
  const getValue = (key: string): string => {
    const match = tomlRaw.match(new RegExp(`^${key}\\s*=\\s*"(.+)"`, "m"));
    return match?.[1] || "";
  };

  const manifest = {
    name: getValue("name"),
    slug: getValue("slug"),
    description: getValue("description"),
    version: getValue("version") || "0.1.0",
    category: getValue("category") || "Utility",
    tags: [] as string[],
    mcp: { endpoint: "/mcp", transport: "streamable-http" },
    pricing: { type: getValue("type") || "free" },
  };

  // Read source code
  onProgress("bundling", "Bundling source code...");
  let sourceCode: string;
  try {
    sourceCode = await readFile(resolve(projectDir, "src/tools.ts"), "utf-8");
  } catch {
    sourceCode = await readFile(resolve(projectDir, "src/index.ts"), "utf-8");
  }

  const schemaSql = await readOptionalFile(projectDir, "schema.sql");

  // Bundle UI and server files
  let uiFiles: Record<string, string> | null = null;
  const uiDir = resolve(projectDir, "ui");
  if (existsSync(uiDir)) {
    const files = await readDirRecursive(uiDir, uiDir);
    if (Object.keys(files).length > 0) uiFiles = files;
  }

  let serverFiles: Record<string, string> | null = null;
  const srcDir = resolve(projectDir, "src");
  if (existsSync(srcDir)) {
    const files = await readDirRecursive(srcDir, srcDir, ["index.ts", "_worker.ts"]);
    if (Object.keys(files).length > 0) serverFiles = files;
  }

  // Submit
  onProgress("publishing", "Publishing to Pinchers.ai...");
  const platformUrl = getPlatformUrl();

  const res = await fetch(`${platformUrl}/api/tools/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      manifest,
      source_code: sourceCode,
      readme_md: "",
      ...(uiFiles ? { ui_files: uiFiles } : {}),
      ...(serverFiles ? { server_files: serverFiles } : {}),
      ...(schemaSql ? { schema_sql: schemaSql } : {}),
    }),
  });

  if (res.ok) {
    const json = (await res.json()) as { slug: string; status: string };
    return {
      slug: json.slug,
      url: `${platformUrl}/browse/${json.slug}`,
      mcpUrl: `${platformUrl}/api/mcp/${json.slug}`,
    };
  } else {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Publish failed");
  }
}
