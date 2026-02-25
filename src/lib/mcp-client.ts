/**
 * Shared MCP protocol client for REPL and test commands.
 * Handles session initialization, JSON-RPC calls, and SSE response parsing.
 */

export interface McpSession {
  sessionId: string | null;
  msgId: number;
  endpoint: string;
}

export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { type?: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export function createSession(endpoint: string): McpSession {
  return { sessionId: null, msgId: 1, endpoint };
}

export async function mcpCall(
  session: McpSession,
  method: string,
  params: Record<string, unknown> = {}
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream, application/json",
  };
  if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: session.msgId++,
    method,
    params,
  });

  const res = await fetch(session.endpoint, { method: "POST", headers, body });

  const sid = res.headers.get("mcp-session-id");
  if (sid) session.sessionId = sid;

  const text = await res.text();

  // Try SSE format first
  const lines = text.split("\n").filter((l) => l.startsWith("data: "));
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line.slice(6));
      if (parsed.result) return parsed.result;
      if (parsed.error) throw new Error(parsed.error.message || "MCP error");
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== "MCP error") continue;
      throw e;
    }
  }

  // Fallback to plain JSON
  try {
    const json = JSON.parse(text);
    if (json.result) return json.result;
    if (json.error) throw new Error(json.error.message || "MCP error");
  } catch {
    // Not JSON either
  }

  return null;
}

export async function initializeSession(session: McpSession): Promise<void> {
  if (session.sessionId) return;

  await mcpCall(session, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "pinch-cli", version: "1.0.0" },
  });

  // Send initialized notification
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;

  await fetch(session.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });
}

export async function listTools(session: McpSession): Promise<ToolSchema[]> {
  await initializeSession(session);
  const result = await mcpCall(session, "tools/list", {});
  return result?.tools || [];
}

export async function callTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown> = {}
): Promise<any> {
  await initializeSession(session);
  return mcpCall(session, "tools/call", { name, arguments: args });
}

export function buildMinimalInput(schema: ToolSchema): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const props = schema.inputSchema?.properties || {};
  const required = schema.inputSchema?.required || [];

  for (const key of required) {
    const prop = props[key];
    if (!prop) continue;

    if (prop.enum && prop.enum.length > 0) {
      input[key] = prop.enum[0];
    } else if (prop.type === "string") {
      input[key] = "test";
    } else if (prop.type === "number" || prop.type === "integer") {
      input[key] = 1;
    } else if (prop.type === "boolean") {
      input[key] = true;
    } else if (prop.type === "array") {
      input[key] = [];
    } else if (prop.type === "object") {
      input[key] = {};
    } else {
      input[key] = "test";
    }
  }

  return input;
}
