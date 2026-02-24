import { starterTemplate } from "./starter.js";
import { invoiceTemplate } from "./invoice.js";
import { dataFetcherTemplate } from "./data-fetcher.js";
import { automationTemplate } from "./automation.js";
import { customUITemplate } from "./custom-ui.js";

export { getPlaygroundHtml } from "./playground.js";

export interface TemplateChoice {
  value: string;
  name: string;
  description: string;
}

export const TEMPLATES: TemplateChoice[] = [
  { value: "starter", name: "Starter", description: "Hello world — simplest possible MCP server" },
  { value: "custom-ui", name: "Custom UI", description: "MCP server with your own frontend (ui/ directory + bridge)" },
  { value: "invoice", name: "Invoice Tool", description: "Create invoices with line items, totals, and formatting" },
  { value: "data-fetcher", name: "Data Fetcher", description: "Fetch and parse data from external APIs" },
  { value: "automation", name: "Automation Bot", description: "Task management with multi-step workflows" },
];

export type TemplateGenerator = (
  name: string,
  slug: string,
  description: string,
  category: string
) => Record<string, string>;

export const templateGenerators: Record<string, TemplateGenerator> = {
  starter: starterTemplate,
  "custom-ui": customUITemplate,
  invoice: invoiceTemplate,
  "data-fetcher": dataFetcherTemplate,
  automation: automationTemplate,
};
