import { starterTemplate } from "./starter.js";
import { invoiceTemplate } from "./invoice.js";
import { dataFetcherTemplate } from "./data-fetcher.js";
import { automationTemplate } from "./automation.js";

export interface TemplateChoice {
  value: string;
  name: string;
  description: string;
}

export const TEMPLATES: TemplateChoice[] = [
  { value: "starter", name: "Starter", description: "Hello world — simplest possible MCP server" },
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
  invoice: invoiceTemplate,
  "data-fetcher": dataFetcherTemplate,
  automation: automationTemplate,
};
