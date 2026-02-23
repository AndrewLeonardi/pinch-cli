import { getPlaygroundHtml } from "./playground.js";

export function starterTemplate(
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
category = "${category}"
tags = []

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "free"
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

const server = new McpServer({
  name: "${name}",
  version: "0.1.0",
});

// Define your tools here
server.tool(
  "hello",
  "Say hello to someone. Use this when someone wants a friendly greeting.",
  { name: z.string().describe("Name of the person to greet") },
  async ({ name }) => ({
    content: [{ type: "text", text: \`Hello, \${name}! 🦞\` }],
  })
);

// Create transport and connect once at startup
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});
await server.connect(transport);

// HTTP server
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
    ".gitignore": "node_modules/\ndist/\n.env\n",
  };
}
