import { starterTemplate } from "./starter.js";
import { invoiceTemplate } from "./invoice.js";
import { dataFetcherTemplate } from "./data-fetcher.js";
import { automationTemplate } from "./automation.js";
import { customUITemplate } from "./custom-ui.js";
import { weatherDashboardTemplate } from "./weather-dashboard.js";
import { aiChatTemplate } from "./ai-chat.js";

export { getPlaygroundHtml } from "./playground.js";

export interface TemplateChoice {
  value: string;
  name: string;
  description: string;
}

export const TEMPLATES: TemplateChoice[] = [
  { value: "hello-world", name: "Hello World", description: "Simplest possible MCP server — one tool, zero config" },
  { value: "full-stack", name: "Full Stack", description: "MCP server + custom frontend (ui/ directory + bridge API)" },
  { value: "invoice", name: "Invoice Tool", description: "Generate invoices with line items, tax, and formatting" },
  { value: "api-client", name: "API Client", description: "Fetch and parse data from external APIs" },
  { value: "task-manager", name: "Task Manager", description: "CRUD task management with persistent storage" },
  { value: "weather-dashboard", name: "Weather Dashboard", description: "Weather data tools + polished chart UI (showcase)" },
  { value: "ai-chat", name: "AI Chat", description: "LLM-powered chat interface with streaming (showcase)" },
];

export type TemplateGenerator = (
  name: string,
  slug: string,
  description: string,
  category: string
) => Record<string, string>;

export const templateGenerators: Record<string, TemplateGenerator> = {
  "hello-world": starterTemplate,
  "full-stack": customUITemplate,
  invoice: invoiceTemplate,
  "api-client": dataFetcherTemplate,
  "task-manager": automationTemplate,
  "weather-dashboard": weatherDashboardTemplate,
  "ai-chat": aiChatTemplate,
};
