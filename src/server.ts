/**
 * Local HTTP server for the pinch guided experience.
 * Serves the web UI and API endpoints for demo, scaffold, test, deploy.
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import net from "net";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, ChildProcess, execSync } from "child_process";
import {
  createSession,
  initializeSession,
  listTools,
  callTool,
  type McpSession,
} from "./lib/mcp-client.js";
import { getTemplates, scaffoldProject } from "./lib/templates.js";
import { deployToCloudflare, deployToPinchers } from "./lib/deploy.js";
import { loadConfig, saveConfig, getPlatformUrl } from "./lib/config.js";
import open from "open";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── State ────────────────────────────────────────────────

interface AppState {
  projectDir: string | null;
  projectSlug: string | null;
  projectName: string | null;
  devServerProcess: ChildProcess | null;
  devServerPort: number;
  devServerLogs: string[];
  demoSession: McpSession | null;
  testSession: McpSession | null;
  deployStatus: { stage: string; message: string; done: boolean; url?: string; error?: string } | null;
}

const state: AppState = {
  projectDir: null,
  projectSlug: null,
  projectName: null,
  devServerProcess: null,
  devServerPort: 3101,
  devServerLogs: [],
  demoSession: null,
  testSession: null,
  deployStatus: null,
};

// ── Project Detection ───────────────────────────────────

function detectExistingProject(): { slug: string; name: string; dir: string } | null {
  const tomlPath = resolve(process.cwd(), "pinch.toml");
  if (!existsSync(tomlPath)) return null;
  try {
    const toml = readFileSync(tomlPath, "utf-8");
    const nameMatch = toml.match(/^name\s*=\s*"(.+)"/m);
    const slugMatch = toml.match(/^slug\s*=\s*"(.+)"/m);
    if (!nameMatch || !slugMatch) return null;
    return { name: nameMatch[1], slug: slugMatch[1], dir: process.cwd() };
  } catch {
    return null;
  }
}

function pushLog(line: string) {
  state.devServerLogs.push(line);
  if (state.devServerLogs.length > 500) {
    state.devServerLogs.splice(0, state.devServerLogs.length - 500);
  }
}

// ── Helpers ──────────────────────────────────────────────

function loadUI(): string {
  // Try loading the HTML file (works both in src/ dev and dist/)
  const paths = [
    resolve(__dirname, "ui.html"),
    resolve(__dirname, "../src/ui.html"),
  ];
  for (const p of paths) {
    try {
      return readFileSync(p, "utf-8");
    } catch {}
  }
  return "<html><body><h1>UI not found</h1></body></html>";
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function json(res: ServerResponse, data: any, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function cors(res: ServerResponse) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

// ── Dev Server Management ───────────────────────────────

/** Check if a port is free by trying to listen on it. */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => { srv.close(); resolve(true); });
    srv.listen(port, "127.0.0.1");
  });
}

/** Find an available port starting from `start`, trying up to 20 ports. */
async function findAvailablePort(start: number): Promise<number> {
  for (let p = start; p < start + 20; p++) {
    if (await isPortFree(p)) return p;
  }
  return start; // fallback
}

/** Try to kill whatever is occupying a port (best-effort). */
function killPortProcess(port: number) {
  try {
    const pid = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
    if (pid) {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      pushLog(`[killed stale process ${pid} on port ${port}]`);
    }
  } catch {
    // nothing on that port, or kill failed — fine
  }
}

async function startDevServer(dir: string) {
  if (state.devServerProcess) {
    state.devServerProcess.kill();
  }

  // Find a free port (kill stale process on preferred port first)
  let devPort = state.devServerPort;
  if (!(await isPortFree(devPort))) {
    pushLog(`[port ${devPort} in use — attempting cleanup]`);
    killPortProcess(devPort);
    // Give it a moment to release
    await new Promise((r) => setTimeout(r, 500));
    if (!(await isPortFree(devPort))) {
      devPort = await findAvailablePort(devPort + 1);
      pushLog(`[using alternate port ${devPort}]`);
    }
  }
  state.devServerPort = devPort;

  state.devServerProcess = spawn("npx", ["tsx", "--watch", "src/index.ts"], {
    cwd: dir,
    env: { ...process.env, PORT: String(devPort) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  state.devServerProcess.stdout?.on("data", (d: Buffer) => {
    d.toString().split("\n").filter(Boolean).forEach((line) => pushLog(line));
  });
  state.devServerProcess.stderr?.on("data", (d: Buffer) => {
    d.toString().split("\n").filter(Boolean).forEach((line) => pushLog(`[err] ${line}`));
  });
  state.devServerProcess.on("close", (code) => {
    pushLog(`[dev server exited with code ${code}]`);
    state.devServerProcess = null;
  });
}

async function runNpmInstall(dir: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("npm", ["install"], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code || 0, stderr }));
    child.on("error", (err) => resolve({ code: 1, stderr: err.message }));
  });
}

// ── Route handlers ───────────────────────────────────────

async function handleDemo(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  const endpoint = "https://mcp-server.andrewleonardi24.workers.dev/mcp";

  try {
    if (!state.demoSession) {
      state.demoSession = createSession(endpoint);
    }

    if (body.method === "list") {
      const tools = await listTools(state.demoSession);
      json(res, { tools });
    } else if (body.method === "call") {
      const result = await callTool(state.demoSession, body.name, body.args || {});
      json(res, { result });
    } else {
      json(res, { error: "Unknown method" }, 400);
    }
  } catch (err: any) {
    // Reset session on failure and retry once
    state.demoSession = null;
    json(res, { error: err.message }, 500);
  }
}

async function handleTemplates(_req: IncomingMessage, res: ServerResponse) {
  json(res, { templates: getTemplates() });
}

async function handleScaffold(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  const { template, name, description, source_code, server_files, schema_sql } = body;

  if (!template || !name) {
    json(res, { error: "template and name are required" }, 400);
    return;
  }

  try {
    const result = scaffoldProject(template, name, description || "An MCP server built with pinch", {
      source_code,
      server_files,
      schema_sql,
    });

    state.projectDir = result.dir;
    state.projectSlug = result.slug;

    json(res, { slug: result.slug, dir: result.dir, status: "installing" });
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

async function handleInstallAndStart(req: IncomingMessage, res: ServerResponse) {
  if (!state.projectDir) {
    json(res, { error: "No project scaffolded yet" }, 400);
    return;
  }

  try {
    const installResult = await runNpmInstall(state.projectDir);

    if (installResult.code !== 0) {
      json(res, { error: "npm install failed: " + installResult.stderr.slice(0, 200) }, 500);
      return;
    }

    await startDevServer(state.projectDir);

    // Wait a moment for server to start
    await new Promise((r) => setTimeout(r, 3000));

    json(res, { status: "running", port: state.devServerPort });
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

async function handleTest(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  const endpoint = `http://localhost:${state.devServerPort}/mcp`;

  try {
    if (!state.testSession) {
      state.testSession = createSession(endpoint);
    }

    if (body.method === "list") {
      const tools = await listTools(state.testSession);
      json(res, { tools });
    } else if (body.method === "call") {
      const result = await callTool(state.testSession, body.name, body.args || {});
      json(res, { result });
    } else {
      json(res, { error: "Unknown method" }, 400);
    }
  } catch (err: any) {
    // Reset session on failure
    state.testSession = null;
    json(res, { error: err.message }, 500);
  }
}

async function handleAuthStart(_req: IncomingMessage, res: ServerResponse) {
  const platformUrl = getPlatformUrl();

  try {
    const config = await loadConfig();
    if (config.api_key) {
      json(res, { authenticated: true, email: config.email });
      return;
    }

    const codeRes = await fetch(`${platformUrl}/api/cli/code`, { method: "POST" });
    const { code } = (await codeRes.json()) as { code: string };

    const authUrl = `${platformUrl}/cli/auth?code=${code}`;
    await open(authUrl);

    json(res, { code, authUrl, status: "pending" });
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

async function handleAuthPoll(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", "http://localhost");
  const code = url.searchParams.get("code");

  if (!code) {
    json(res, { error: "code parameter required" }, 400);
    return;
  }

  const platformUrl = getPlatformUrl();

  try {
    const verifyRes = await fetch(`${platformUrl}/api/cli/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (verifyRes.ok) {
      const { api_key, email } = (await verifyRes.json()) as { api_key: string; email: string };
      await saveConfig({ api_key, email });
      json(res, { authenticated: true, email });
    } else if (verifyRes.status === 202) {
      json(res, { authenticated: false, status: "pending" });
    } else if (verifyRes.status === 410) {
      json(res, { error: "Auth code expired" }, 410);
    } else {
      json(res, { authenticated: false, status: "pending" });
    }
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

async function handleAuthCheck(_req: IncomingMessage, res: ServerResponse) {
  const config = await loadConfig();
  json(res, { authenticated: !!config.api_key, email: config.email || null });
}

async function handleDeploy(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  const { target } = body;

  if (!state.projectDir) {
    json(res, { error: "No project scaffolded yet" }, 400);
    return;
  }

  state.deployStatus = { stage: "starting", message: "Preparing deployment...", done: false };

  // Run deploy in background
  if (target === "cloudflare") {
    const { cfToken, cfAccountId } = body;
    if (!cfToken || !cfAccountId) {
      json(res, { error: "cfToken and cfAccountId required" }, 400);
      return;
    }

    // Save CF creds
    const config = await loadConfig();
    config.cf_api_token = cfToken;
    config.cf_account_id = cfAccountId;
    await saveConfig(config);

    json(res, { status: "deploying" });

    deployToCloudflare({
      projectDir: state.projectDir,
      cfToken,
      cfAccountId,
      onProgress: (stage, message) => {
        state.deployStatus = { stage, message, done: false };
      },
    }).then((result) => {
      state.deployStatus = { stage: "done", message: "Deployed!", done: true, url: result.url };
    }).catch((err) => {
      state.deployStatus = { stage: "error", message: err.message, done: true, error: err.message };
    });
  } else if (target === "pinchers") {
    const config = await loadConfig();
    if (!config.api_key) {
      json(res, { error: "Not logged in to Pinchers.ai" }, 401);
      return;
    }

    json(res, { status: "deploying" });

    deployToPinchers({
      projectDir: state.projectDir,
      apiKey: config.api_key,
      onProgress: (stage, message) => {
        state.deployStatus = { stage, message, done: false };
      },
    }).then((result) => {
      state.deployStatus = { stage: "done", message: "Published!", done: true, url: result.url };
    }).catch((err) => {
      state.deployStatus = { stage: "error", message: err.message, done: true, error: err.message };
    });
  } else {
    json(res, { error: "Unknown target" }, 400);
  }
}

async function handleDeployStatus(_req: IncomingMessage, res: ServerResponse) {
  json(res, state.deployStatus || { stage: "idle", message: "", done: false });
}

async function handleProjectStatus(_req: IncomingMessage, res: ServerResponse) {
  if (!state.projectDir) {
    json(res, { exists: false });
    return;
  }
  json(res, {
    exists: true,
    slug: state.projectSlug,
    name: state.projectName,
    dir: state.projectDir,
    devServer: state.devServerProcess
      ? { running: true, port: state.devServerPort }
      : { running: false },
  });
}

async function handleUpdate(req: IncomingMessage, res: ServerResponse) {
  if (!state.projectDir) {
    json(res, { error: "No project found" }, 400);
    return;
  }

  const body = await readBody(req);
  const { source_code, server_files, schema_sql } = body;

  if (!source_code) {
    json(res, { error: "source_code is required" }, 400);
    return;
  }

  try {
    const changes: string[] = [];

    // Write src/tools.ts
    const toolsPath = resolve(state.projectDir, "src/tools.ts");
    writeFileSync(toolsPath, source_code, "utf-8");
    changes.push("src/tools.ts");

    // Write server_files
    if (server_files && typeof server_files === "object") {
      for (const [path, content] of Object.entries(server_files)) {
        const fullPath = resolve(state.projectDir, "src", path);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content as string, "utf-8");
        changes.push(`src/${path}`);
      }
    }

    // Write schema.sql
    if (schema_sql) {
      writeFileSync(resolve(state.projectDir, "schema.sql"), schema_sql, "utf-8");
      changes.push("schema.sql");
    }

    // tsx --watch will auto-reload — reset test session for fresh connection
    state.testSession = null;

    json(res, { changes, message: "Files updated. Dev server will hot-reload." });
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

async function handleLogs(_req: IncomingMessage, res: ServerResponse) {
  json(res, { logs: state.devServerLogs.slice(-100) });
}

// ── Server ───────────────────────────────────────────────

export async function startServer(port: number): Promise<string> {
  const uiHtml = loadUI();

  // Detect existing project in cwd
  const existing = detectExistingProject();
  if (existing) {
    state.projectDir = existing.dir;
    state.projectSlug = existing.slug;
    state.projectName = existing.name;
    console.log(`  📁 Found project: ${existing.name} (${existing.slug})`);

    // Auto-install if needed
    if (!existsSync(resolve(existing.dir, "node_modules"))) {
      console.log("  📦 Installing dependencies...");
      const result = await runNpmInstall(existing.dir);
      if (result.code !== 0) {
        console.log("  ⚠️  npm install failed:", result.stderr.slice(0, 100));
      }
    }

    // Auto-start dev server
    await startDevServer(existing.dir);
    console.log(`  ⚡ Dev server starting on port ${state.devServerPort}`);
  }

  const server = createServer(async (req, res) => {
    const url = (req.url || "/").split("?")[0];

    // CORS preflight
    if (req.method === "OPTIONS") {
      cors(res);
      return;
    }

    try {
      // Serve UI
      if (req.method === "GET" && (url === "/" || url === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(uiHtml);
        return;
      }

      // API routes
      if (req.method === "GET" && url === "/api/project") return await handleProjectStatus(req, res);
      if (req.method === "POST" && url === "/api/update") return await handleUpdate(req, res);
      if (req.method === "GET" && url === "/api/logs") return await handleLogs(req, res);
      if (req.method === "POST" && url === "/api/demo") return await handleDemo(req, res);
      if (req.method === "GET" && url === "/api/templates") return await handleTemplates(req, res);
      if (req.method === "POST" && url === "/api/scaffold") return await handleScaffold(req, res);
      if (req.method === "POST" && url === "/api/install") return await handleInstallAndStart(req, res);
      if (req.method === "POST" && url === "/api/test") return await handleTest(req, res);
      if (req.method === "POST" && url === "/api/deploy") return await handleDeploy(req, res);
      if (req.method === "GET" && url === "/api/deploy/status") return await handleDeployStatus(req, res);
      if (req.method === "POST" && url === "/api/auth/start") return await handleAuthStart(req, res);
      if (req.method === "GET" && url.startsWith("/api/auth/poll")) return await handleAuthPoll(req, res);
      if (req.method === "GET" && url === "/api/auth/check") return await handleAuthCheck(req, res);

      // 404
      res.writeHead(404);
      res.end("Not found");
    } catch (err: any) {
      console.error("Server error:", err);
      json(res, { error: "Internal server error" }, 500);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(`http://localhost:${port}`);
    });
  });
}
