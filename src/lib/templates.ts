/**
 * Two templates: hello-world and invoice.
 * Scaffolds a complete MCP project to disk.
 */

import { mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { generateWranglerConfig } from "./worker-gen.js";

// ── Template metadata ────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export function getTemplates(): Template[] {
  return [
    {
      id: "hello-world",
      name: "Hello World",
      description: "The simplest MCP server. One tool, says hello.",
      icon: "👋",
    },
    {
      id: "invoice",
      name: "Invoice Tool",
      description: "Generate invoices with line items and totals.",
      icon: "🧾",
    },
  ];
}

// ── Shared scaffolding ───────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getPackageJson(slug: string, description: string): string {
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

function getTsConfig(): string {
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

function getGitignore(): string {
  return `node_modules/
dist/
.env
.pinch-data.json
src/_worker.ts
.wrangler/
`;
}

function getManifest(name: string, slug: string, description: string, category: string, pricingType: string): string {
  return `[tool]
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
type = "${pricingType}"
`;
}

function getDevServer(name: string): string {
  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { registerTools } from "./tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Storage (local dev: JSON file, production: CF KV) ────

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

// ── Session Management ───────────────────────────────────

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

// ── HTTP Server ──────────────────────────────────────────

const httpServer = createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];

  if (req.method === "GET" && url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ name: "${name}", version: "0.1.0", mcp: "/mcp" }));
    return;
  }

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
  console.log(\`   MCP endpoint: http://localhost:\${PORT}/mcp\`);
});
`;
}

// ── Template-specific tools code ─────────────────────────

function getHelloWorldTools(): string {
  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerTools(server: McpServer, storage: any) {
  server.tool(
    "hello",
    "Say hello to someone. Use this when someone wants a friendly greeting.",
    { name: z.string().describe("Name of the person to greet") },
    async ({ name }) => ({
      content: [{ type: "text", text: \`Hello, \${name}! ⚡\` }],
    })
  );
}
`;
}

function getInvoiceTools(): string {
  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ── Helpers ────────────────────────────────────────────

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = prefix + "_";
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", JPY: "¥",
};

function formatCurrency(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || currency + " ";
  return sym + amount.toFixed(2);
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const lineItemSchema = z.object({
  description: z.string().describe("Description of the line item"),
  quantity: z.number().default(1).describe("Quantity (defaults to 1)"),
  unit_price: z.number().describe("Price per unit"),
});

const currencySchema = z
  .enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY"])
  .default("USD")
  .describe("Currency code");

// ── Tool Registration ─────────────────────────────────

export function registerTools(server: McpServer, storage: any) {
  server.tool(
    "create_invoice",
    "Create a professional invoice with line items and totals.",
    {
      client_name: z.string().describe("Client or company name"),
      from_name: z.string().optional().describe("Your name or business name"),
      items: z.array(lineItemSchema).min(1).describe("Line items for the invoice"),
      currency: currencySchema,
      due_days: z.number().default(30).describe("Days until payment is due"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async ({ client_name, from_name, items, currency, due_days, notes }) => {
      const invoiceId = generateId("inv");
      const now = new Date();
      const dueDate = new Date(now.getTime() + due_days * 86400000);

      const lineItems = items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
      }));

      const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);

      return jsonResult({
        invoice_id: invoiceId,
        status: "created",
        from: from_name || "Your Business",
        client: client_name,
        date: now.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        line_items: lineItems.map((li) => ({
          ...li,
          total: formatCurrency(li.total, currency),
        })),
        subtotal: formatCurrency(subtotal, currency),
        total: formatCurrency(subtotal, currency),
        currency,
        notes: notes || null,
      });
    }
  );

  server.tool(
    "calculate_totals",
    "Calculate invoice totals with optional tax and discounts.",
    {
      items: z.array(lineItemSchema).min(1).describe("Line items to calculate"),
      tax_rate: z.number().min(0).max(100).optional().describe("Tax rate as percentage"),
      discount_percent: z.number().min(0).max(100).optional().describe("Discount percentage"),
      currency: currencySchema,
    },
    async ({ items, tax_rate, discount_percent, currency }) => {
      const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const discount = discount_percent ? subtotal * (discount_percent / 100) : 0;
      const afterDiscount = subtotal - discount;
      const tax = tax_rate ? afterDiscount * (tax_rate / 100) : 0;
      const total = afterDiscount + tax;

      return jsonResult({
        subtotal: formatCurrency(subtotal, currency),
        discount: discount > 0 ? formatCurrency(discount, currency) : null,
        tax: tax > 0 ? formatCurrency(tax, currency) : null,
        total: formatCurrency(total, currency),
        currency,
      });
    }
  );
}
`;
}

// ── Scaffold to disk ─────────────────────────────────────

interface ScaffoldOptions {
  source_code?: string;
  server_files?: Record<string, string>;
  schema_sql?: string;
}

export function scaffoldProject(
  templateId: string,
  name: string,
  description: string,
  options: ScaffoldOptions = {}
): { slug: string; dir: string } {
  const slug = slugify(name);
  const dir = resolve(process.cwd(), slug);

  // Determine tools source code
  let toolsCode: string;
  let category: string;
  let pricingType: string;

  if (templateId === "json-import" && options.source_code) {
    // Custom JSON import — use the provided source code directly
    toolsCode = options.source_code;
    category = "Utility";
    pricingType = "free";
  } else if (templateId === "invoice") {
    toolsCode = getInvoiceTools();
    category = "Finance";
    pricingType = "credits";
  } else {
    toolsCode = getHelloWorldTools();
    category = "Utility";
    pricingType = "free";
  }

  const files: Record<string, string> = {
    "pinch.toml": getManifest(name, slug, description, category, pricingType),
    "src/tools.ts": toolsCode,
    "src/index.ts": getDevServer(name),
    "wrangler.toml": generateWranglerConfig(slug, name),
    "package.json": getPackageJson(slug, description),
    "tsconfig.json": getTsConfig(),
    ".gitignore": getGitignore(),
  };

  // Add extra server files from JSON import (e.g., "db/queries.ts" → "src/db/queries.ts")
  if (options.server_files) {
    for (const [path, content] of Object.entries(options.server_files)) {
      files[`src/${path}`] = content;
    }
  }

  // Add schema SQL if provided
  if (options.schema_sql) {
    files["schema.sql"] = options.schema_sql;
  }

  // Write all files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = resolve(dir, filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }

  return { slug, dir };
}
