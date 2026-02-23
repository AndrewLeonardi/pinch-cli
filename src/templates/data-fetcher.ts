import { getPlaygroundHtml } from "./playground.js";

export function dataFetcherTemplate(
  name: string,
  slug: string,
  description: string,
  category: string
): Record<string, string> {
  const manifest = `[tool]
name = "${name}"
slug = "${slug}"
description = "${description}"
version = "0.1.0"
category = "${category || "Research"}"
tags = ["api", "fetch", "data"]

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "free"

[[test]]
tool = "check_status"
input = { url = "https://httpbin.org/status/200" }
expect_contains = "200"

[[test]]
tool = "fetch_json"
input = { url = "https://httpbin.org/json" }
expect_type = "json"
`;

  const serverCode = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// Load playground HTML at startup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const playgroundHtml = (() => {
  try {
    return readFileSync(resolve(__dirname, "../public/playground.html"), "utf-8");
  } catch {
    return "<html><body><h1>Playground not found</h1><p>Run pinch init to regenerate.</p></body></html>";
  }
})();

// ── Helpers ────────────────────────────────────────────

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function extractPath(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

// ── MCP Server ─────────────────────────────────────────

const server = new McpServer({
  name: "${name}",
  version: "0.1.0",
});

server.tool(
  "fetch_json",
  "Fetch JSON data from a URL and optionally extract a nested value. Use this when someone wants to pull data from an API, read a JSON endpoint, or extract specific fields from a JSON response.",
  {
    url: z.string().url().describe("The URL to fetch JSON from"),
    headers: z
      .record(z.string())
      .optional()
      .describe("Optional HTTP headers (e.g. Authorization)"),
    path: z
      .string()
      .optional()
      .describe("Dot-notation path to extract (e.g. 'data.items' or 'results.0.name')"),
  },
  async ({ url, headers, path }) => {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...headers },
      });

      if (!res.ok) {
        return jsonResult({
          error: \`HTTP \${res.status} \${res.statusText}\`,
          hint: "Check the URL and try again",
        });
      }

      const data = await res.json();

      if (path) {
        const extracted = extractPath(data, path);
        if (extracted === undefined) {
          return jsonResult({
            error: \`Path "\${path}" not found in response\`,
            available_keys: typeof data === "object" && data !== null ? Object.keys(data) : [],
          });
        }
        return jsonResult(extracted);
      }

      return jsonResult(data);
    } catch (err) {
      return jsonResult({
        error: String(err instanceof Error ? err.message : err),
        hint: "Make sure the URL is reachable and returns valid JSON",
      });
    }
  }
);

server.tool(
  "fetch_text",
  "Fetch raw text content from a URL. Use this when someone wants to read a plain text page, download a file's content, or get non-JSON data from a URL.",
  {
    url: z.string().url().describe("The URL to fetch text from"),
    headers: z
      .record(z.string())
      .optional()
      .describe("Optional HTTP headers"),
    max_length: z
      .number()
      .default(5000)
      .describe("Maximum characters to return (default 5000)"),
  },
  async ({ url, headers, max_length }) => {
    try {
      const res = await fetch(url, { headers });

      if (!res.ok) {
        return textResult(\`Error: HTTP \${res.status} \${res.statusText}\`);
      }

      let text = await res.text();
      if (text.length > max_length) {
        text = text.slice(0, max_length) + \`\\n\\n... (truncated at \${max_length} chars)\`;
      }

      return textResult(text);
    } catch (err) {
      return textResult(\`Error: \${err instanceof Error ? err.message : String(err)}\`);
    }
  }
);

server.tool(
  "check_status",
  "Check if a URL is reachable and get its HTTP status, headers, and response time. Use this when someone wants to verify a website is up, check API health, or measure endpoint latency.",
  {
    url: z.string().url().describe("The URL to check"),
  },
  async ({ url }) => {
    const start = Date.now();
    try {
      const res = await fetch(url, { method: "HEAD" });
      const elapsed = Date.now() - start;

      const headerObj: Record<string, string> = {};
      res.headers.forEach((v, k) => { headerObj[k] = v; });

      return jsonResult({
        url,
        status: res.status,
        status_text: res.statusText,
        ok: res.ok,
        response_time_ms: elapsed,
        headers: headerObj,
      });
    } catch (err) {
      const elapsed = Date.now() - start;
      return jsonResult({
        url,
        status: 0,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        response_time_ms: elapsed,
      });
    }
  }
);

// ── HTTP Server ────────────────────────────────────────

// Create transport and connect once at startup
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});
await server.connect(transport);

const httpServer = createServer(async (req, res) => {
  // Serve playground UI
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(playgroundHtml);
    return;
  }

  // MCP endpoint
  if (req.url === "/mcp" && req.method === "POST") {
    await transport.handleRequest(req, res);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const PORT = process.env.PORT || 3100;
httpServer.listen(PORT, () => {
  console.log(\`🦞 ${name} running on http://localhost:\${PORT}\`);
  console.log(\`   Playground: http://localhost:\${PORT}\`);
  console.log(\`   MCP endpoint: http://localhost:\${PORT}/mcp\`);
});
`;

  const pkg = JSON.stringify(
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
        zod: "^3.24.4",
      },
      devDependencies: {
        typescript: "^5.8.3",
        tsx: "^4.19.0",
        "@types/node": "^22.15.0",
      },
    },
    null,
    2
  );

  const tsconfig = JSON.stringify(
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
    },
    null,
    2
  );

  return {
    "pinchers.toml": manifest,
    "src/index.ts": serverCode,
    "public/playground.html": getPlaygroundHtml(name, description),
    "package.json": pkg,
    "tsconfig.json": tsconfig,
    ".gitignore": "node_modules/\\ndist/\\n.env\\n",
  };
}
