import { getPlaygroundHtml } from "./playground.js";
import { generateToolsFile, generateDevServer, getPackageJson, getTsConfig, getGitignore, getEnvExample, getReadme } from "./server-runtime.js";
import { generateWranglerConfig } from "../lib/worker-gen.js";

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

  const toolsCode = generateToolsFile({
    helpers: `function generateId(prefix: string): string {
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

const lineItemSchema = z.object({
  description: z.string().describe("Description of the line item"),
  quantity: z.number().default(1).describe("Quantity (defaults to 1)"),
  unit_price: z.number().describe("Price per unit"),
});

const currencySchema = z
  .enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY"])
  .default("USD")
  .describe("Currency code");`,

    tools: `  server.tool(
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
  );`,
  });

  return {
    "pinch.toml": manifest,
    "src/tools.ts": toolsCode,
    "src/index.ts": generateDevServer(name),
    "wrangler.toml": generateWranglerConfig(slug, name),
    "public/playground.html": getPlaygroundHtml(name, description),
    "package.json": getPackageJson(slug, description),
    "tsconfig.json": getTsConfig(),
    ".gitignore": getGitignore(),
    ".env.example": getEnvExample(),
    "README.md": getReadme(name, slug, description),
  };
}
