/**
 * Shared server runtime generators.
 *
 * Every pinch project has two source files:
 *   src/tools.ts  — Tool definitions (user edits this)
 *   src/index.ts  — Dev server (auto-generated infrastructure)
 *
 * Templates only provide the unique parts: tools, helpers, and state.
 * The dev server is the same for all templates.
 */

// ── Tools file generator ────────────────────────────────

export interface ToolsConfig {
  /** Additional import statements (beyond McpServer + zod) */
  imports?: string;
  /** Helper functions (generateId, formatCurrency, etc.) */
  helpers?: string;
  /** Shared state declarations (interfaces, Maps, etc.) */
  state?: string;
  /** Tool registration code — server.tool() calls inside registerTools() */
  tools: string;
}

/**
 * Generate src/tools.ts — the file users actually edit.
 *
 * Exports registerTools(server, storage) which templates populate
 * with their specific tool definitions.
 */
export function generateToolsFile(config: ToolsConfig): string {
  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
${config.imports || ""}
${config.helpers ? "// ── Helpers ────────────────────────────────────────────\n\n" + config.helpers + "\n" : ""}${config.state ? "// ── State ─────────────────────────────────────────────\n\n" + config.state + "\n" : ""}
// ── Tool Registration ─────────────────────────────────
// Add your tools below. Each tool gets a name, description,
// input schema (using Zod), and an async handler.
//
// The \`storage\` parameter gives you persistent key-value storage
// that works both locally (.pinch-data.json) and in production (CF KV).

export function registerTools(server: McpServer, storage: any) {
${config.tools}
}
`;
}

// ── Dev server generator ────────────────────────────────

/**
 * Generate src/index.ts — the local dev server.
 *
 * This is infrastructure code that users shouldn't need to edit.
 * It imports registerTools from tools.ts and wires up:
 *   - Multi-session MCP support
 *   - Bridge injection for custom UIs
 *   - Static file serving
 *   - Fallback playground
 */
export function generateDevServer(name: string): string {
  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { registerTools } from "./tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uiDir = resolve(__dirname, "../ui");
const hasCustomUI = existsSync(resolve(uiDir, "index.html"));

// Load fallback playground (used when no ui/ directory exists)
const playgroundHtml = (() => {
  try {
    return readFileSync(resolve(__dirname, "../public/playground.html"), "utf-8");
  } catch {
    return "<html><body><h1>Playground not found</h1><p>Run pinch init to regenerate.</p></body></html>";
  }
})();

// ── Bridge ──────────────────────────────────────────────
// Auto-injected into custom UI. Provides window.pinch with:
//   callTool(name, args)  — call any MCP tool
//   listTools()           — discover available tools
//   theme                 — design tokens
//   ready                 — Promise that resolves when connected

const bridgeScript = \`<script>
(function() {
  var _sessionId = null;
  var _msgId = 1;

  async function _mcpCall(method, params) {
    var headers = { "Content-Type": "application/json", "Accept": "text/event-stream, application/json" };
    if (_sessionId) headers["Mcp-Session-Id"] = _sessionId;
    var body = JSON.stringify({ jsonrpc: "2.0", id: _msgId++, method: method, params: params || {} });
    var res = await fetch("/mcp", { method: "POST", headers: headers, body: body });
    var sid = res.headers.get("mcp-session-id");
    if (sid) _sessionId = sid;
    var text = await res.text();
    var lines = text.split("\\\\n").filter(function(l) { return l.startsWith("data: "); });
    for (var i = 0; i < lines.length; i++) {
      try {
        var parsed = JSON.parse(lines[i].slice(6));
        if (parsed.result) return parsed.result;
        if (parsed.error) throw new Error(parsed.error.message || "MCP error");
      } catch(e) { if (e.message && e.message !== "MCP error") continue; throw e; }
    }
    if (lines.length === 0) return null;
    throw new Error("No result in MCP response");
  }

  async function _ensureSession() {
    if (_sessionId) return;
    await _mcpCall("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "pinch-ui", version: "1.0.0" }
    });
    var nh = { "Content-Type": "application/json", "Accept": "text/event-stream, application/json" };
    if (_sessionId) nh["Mcp-Session-Id"] = _sessionId;
    fetch("/mcp", { method: "POST", headers: nh, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) });
  }

  var api = {
    callTool: async function(toolName, args) {
      await _ensureSession();
      var result = await _mcpCall("tools/call", { name: toolName, arguments: args || {} });
      var content = result.content || [];
      var textParts = content.filter(function(c) { return c.type === "text" && c.text; }).map(function(c) { return c.text; });
      var text = textParts.join("\\\\n");
      try { return JSON.parse(text); } catch(e) { return text; }
    },
    listTools: async function() {
      await _ensureSession();
      var result = await _mcpCall("tools/list", {});
      return result.tools || [];
    },
    theme: {
      colors: {
        primary: "#e8503a",
        bg: "#f0ece4",
        bgCard: "#ffffff",
        border: "#d9d3c7",
        textPrimary: "#2a2a2a",
        textSecondary: "#6b6b6b"
      },
      fonts: {
        sans: "'DM Sans', system-ui, sans-serif",
        mono: "'JetBrains Mono', monospace"
      }
    },
    saveArtifact: async function(opts) {
      if (!opts || !opts.data) throw new Error("saveArtifact requires { data }");
      var artifactId = opts.id || "art_" + Math.random().toString(36).slice(2, 10);
      console.log("[pinch] saveArtifact (local dev):", artifactId, opts.label || "");
      return { id: artifactId, url: "/p/" + artifactId + " (available after deploy)" };
    },
    ready: _ensureSession().then(function() {
      window.dispatchEvent(new Event("pinch:ready"));
      document.dispatchEvent(new Event("pinch:ready"));
      // Backward compat events
      window.dispatchEvent(new Event("pinchers:ready"));
      document.dispatchEvent(new Event("pinchers:ready"));
    })
  };

  // Primary API
  window.pinch = api;
  // Backward compatibility alias
  window.pinchers = api;
})();
</script>\`;

// ── MIME types ───────────────────────────────────────────

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

// ── Storage ─────────────────────────────────────────────
// Persistent key-value storage for local dev.
// In production (CF Worker), this is replaced with Cloudflare KV.

const _storageFile = resolve(__dirname, "../.pinch-data.json");
const storage = {
  async get(key: string): Promise<any> {
    try {
      const data = JSON.parse(readFileSync(_storageFile, "utf-8"));
      return data[key] ?? null;
    } catch { return null; }
  },
  async set(key: string, value: any): Promise<void> {
    let data: Record<string, any> = {};
    try { data = JSON.parse(readFileSync(_storageFile, "utf-8")); } catch {}
    data[key] = value;
    writeFileSync(_storageFile, JSON.stringify(data, null, 2));
  },
  async delete(key: string): Promise<void> {
    let data: Record<string, any> = {};
    try { data = JSON.parse(readFileSync(_storageFile, "utf-8")); } catch {}
    delete data[key];
    writeFileSync(_storageFile, JSON.stringify(data, null, 2));
  },
  async keys(prefix?: string): Promise<string[]> {
    try {
      const data = JSON.parse(readFileSync(_storageFile, "utf-8"));
      const allKeys = Object.keys(data);
      return prefix ? allKeys.filter((k: string) => k.startsWith(prefix)) : allKeys;
    } catch { return []; }
  }
};

// ── Session Management ──────────────────────────────────

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

const sessions = new Map<string, Session>();

function createToolServer(): McpServer {
  const server = new McpServer({
    name: "${name}",
    version: "0.1.0",
  });

  registerTools(server, storage);

  return server;
}

async function getOrCreateSession(sessionId: string | undefined): Promise<{ session: Session; isNew: boolean; captureId: () => void }> {
  if (sessionId && sessions.has(sessionId)) {
    return { session: sessions.get(sessionId)!, isNew: false, captureId: () => {} };
  }
  const server = createToolServer();
  let generatedId: string | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => {
      generatedId = crypto.randomUUID();
      return generatedId;
    },
  });
  await server.connect(transport);
  const session: Session = { server, transport };
  const captureId = () => {
    if (generatedId && !sessions.has(generatedId)) {
      sessions.set(generatedId, session);
    }
  };
  return { session, isNew: true, captureId };
}

// ── HTTP Server ────────────────────────────────────────

const httpServer = createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];

  // Serve UI (custom or playground)
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    if (hasCustomUI) {
      let html = readFileSync(resolve(uiDir, "index.html"), "utf-8");
      const pathTag = "<script>window.__pinch_path=" + JSON.stringify(process.cwd()) + ";window.__pinch_name=" + JSON.stringify("${name}") + ";</script>";
      html = html.replace("</head>", bridgeScript + "\\n" + pathTag + "\\n</head>");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(playgroundHtml);
    }
    return;
  }

  // Serve static assets from ui/
  if (hasCustomUI && req.method === "GET" && !url.startsWith("/mcp")) {
    const filePath = resolve(uiDir, url.slice(1));
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      const mime = MIME[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      res.end(readFileSync(filePath));
      return;
    }
  }

  // MCP endpoint
  if (url === "/mcp" && req.method === "POST") {
    const incomingSessionId = req.headers["mcp-session-id"] as string | undefined;
    const { session, isNew, captureId } = await getOrCreateSession(incomingSessionId);
    await session.transport.handleRequest(req, res);
    if (isNew) { captureId(); }
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const PORT = process.env.PORT || 3100;
httpServer.listen(PORT, () => {
  console.log(\`⚡ ${name} running on http://localhost:\${PORT}\`);
  if (hasCustomUI) {
    console.log(\`   Custom UI: http://localhost:\${PORT}\`);
  } else {
    console.log(\`   Playground: http://localhost:\${PORT}\`);
  }
  console.log(\`   MCP endpoint: http://localhost:\${PORT}/mcp\`);
});
`;
}

// ── Shared scaffolding helpers ──────────────────────────

/** Common package.json for all templates */
export function getPackageJson(slug: string, description: string): string {
  return JSON.stringify(
    {
      name: slug,
      version: "0.1.0",
      description,
      type: "module",
      scripts: {
        dev: "npx tsx --watch src/index.ts",
        build: "tsc",
        start: "node dist/index.js",
      },
      dependencies: {
        "@modelcontextprotocol/sdk": "^1.12.1",
        agents: "^0.5.1",
        zod: "^3.24.4",
      },
      devDependencies: {
        typescript: "^5.8.3",
        tsx: "^4.19.0",
        "@types/node": "^22.15.0",
        wrangler: "^3.105.0",
        "@cloudflare/workers-types": "^4.20250130.0",
      },
    },
    null,
    2
  );
}

/** Common tsconfig.json for all templates */
export function getTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "./dist",
        rootDir: "./src",
        declaration: true,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ["src/**/*"],
      exclude: ["src/_worker.ts"],
    },
    null,
    2
  );
}

/** Common .gitignore for all templates */
export function getGitignore(): string {
  return `node_modules/
dist/
.env
.pinch-data.json
src/_worker.ts
.wrangler/
`;
}

/** Common .env.example for all templates */
export function getEnvExample(): string {
  return `# Cloudflare Workers deployment (pinch deploy)
# Get these from: https://dash.cloudflare.com
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=

# Optional: override the default port for local dev
# PORT=3100
`;
}

/** Common README.md for all templates */
export function getReadme(name: string, slug: string, description: string): string {
  return `# ${name}

${description}

An MCP (Model Context Protocol) server built with [pinch](https://github.com/AndrewLeonardi/pinch-cli).

## Quick Start

\\\`\\\`\\\`bash
pinch dev          # Start dev server + playground
pinch test         # Validate everything works
pinch deploy       # Deploy to Cloudflare Workers
\\\`\\\`\\\`

## Project Structure

\\\`\\\`\\\`
${slug}/
  src/
    tools.ts       <- Your tool definitions (edit this!)
    index.ts       <- Dev server (auto-generated)
  wrangler.toml    <- Cloudflare Workers config
  pinch.toml       <- Tool manifest
\\\`\\\`\\\`

## Adding Tools

Edit \\\`src/tools.ts\\\` to add new tools:

\\\`\\\`\\\`typescript
server.tool(
  "my_tool",
  "Description of what it does",
  { input: z.string() },
  async ({ input }) => ({
    content: [{ type: "text", text: \\\\\\\`Result: \\\\\\\${input}\\\\\\\` }],
  })
);
\\\`\\\`\\\`

## Deployment

### Cloudflare Workers (recommended)

\\\`\\\`\\\`bash
# Set your credentials (one-time)
export CLOUDFLARE_API_TOKEN=your_token
export CLOUDFLARE_ACCOUNT_ID=your_account_id

# Deploy
pinch deploy
\\\`\\\`\\\`

### Docker

\\\`\\\`\\\`bash
pinch deploy docker
docker compose up
\\\`\\\`\\\`

### Pinchers.ai Marketplace

\\\`\\\`\\\`bash
pinch login
pinch deploy pinchers
\\\`\\\`\\\`
`;
}
