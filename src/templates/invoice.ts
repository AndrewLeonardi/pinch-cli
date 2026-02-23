export function invoiceTemplate(
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
category = "${category || "Finance"}"
tags = ["invoice", "billing", "freelance"]

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "credits"
credit_cost = 2

[[test]]
tool = "create_invoice"
input = { client_name = "Acme Corp", items = '[{"description":"Design work","unit_price":500}]' }
expect_contains = "Acme Corp"

[[test]]
tool = "calculate_totals"
input = { items = '[{"description":"Consulting","unit_price":150,"quantity":10}]' }
expect_contains = "1500"
`;

  const serverCode = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
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

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ── Schemas ────────────────────────────────────────────

const lineItemSchema = z.object({
  description: z.string().describe("Description of the line item"),
  quantity: z.number().default(1).describe("Quantity (defaults to 1)"),
  unit_price: z.number().describe("Price per unit"),
});

const currencySchema = z
  .enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY"])
  .default("USD")
  .describe("Currency code");

// ── MCP Server ─────────────────────────────────────────

const server = new McpServer({
  name: "${name}",
  version: "0.1.0",
});

server.tool(
  "create_invoice",
  "Create a professional invoice with line items and totals. Use this when someone wants to invoice a client, bill for services, or generate a payment request.",
  {
    client_name: z.string().describe("Client or company name"),
    client_email: z.string().email().optional().describe("Client email address"),
    items: z.array(lineItemSchema).min(1).describe("Line items for the invoice"),
    currency: currencySchema,
    due_days: z.number().default(30).describe("Days until payment is due"),
    notes: z.string().optional().describe("Additional notes for the invoice"),
    from_name: z.string().optional().describe("Your name or business name"),
  },
  async ({ client_name, client_email, items, currency, due_days, notes, from_name }) => {
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
      client: { name: client_name, email: client_email || null },
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
  "Calculate invoice totals with optional tax and discounts. Use this when someone needs to compute subtotals, apply tax rates, or calculate discounts on line items.",
  {
    items: z.array(lineItemSchema).min(1).describe("Line items to calculate"),
    tax_rate: z.number().min(0).max(100).optional().describe("Tax rate as percentage (e.g. 8.5)"),
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
      line_items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: formatCurrency(item.unit_price, currency),
        total: formatCurrency(item.quantity * item.unit_price, currency),
      })),
      subtotal: formatCurrency(subtotal, currency),
      discount: discount > 0 ? formatCurrency(discount, currency) : null,
      discount_percent: discount_percent || null,
      tax: tax > 0 ? formatCurrency(tax, currency) : null,
      tax_rate: tax_rate || null,
      total: formatCurrency(total, currency),
      currency,
    });
  }
);

// ── HTTP Server ────────────────────────────────────────

const httpServer = createServer(async (req, res) => {
  if (req.url === "/mcp" && req.method === "POST") {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const PORT = process.env.PORT || 3100;
httpServer.listen(PORT, () => {
  console.log(\`🦞 ${name} running on http://localhost:\${PORT}/mcp\`);
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
    "package.json": pkg,
    "tsconfig.json": tsconfig,
    ".gitignore": "node_modules/\\ndist/\\n.env\\n",
  };
}
