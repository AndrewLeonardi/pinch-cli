import { getPlaygroundHtml } from "./playground.js";

export function automationTemplate(
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
category = "${category || "Productivity"}"
tags = ["automation", "tasks", "workflow"]

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "free"

[[test]]
tool = "create_task"
input = { title = "Test task", priority = "high" }
expect_contains = "task_"

[[test]]
tool = "list_tasks"
input = {}
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

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = prefix + "_";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ── In-memory state ────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done";
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

const tasks = new Map<string, Task>();

// ── MCP Server ─────────────────────────────────────────

const server = new McpServer({
  name: "${name}",
  version: "0.1.0",
});

server.tool(
  "create_task",
  "Create a new task with a title, priority, and optional due date. Use this when someone wants to add a to-do item, create a reminder, or track work that needs to be done.",
  {
    title: z.string().describe("Title of the task"),
    description: z.string().optional().describe("Detailed description of what needs to be done"),
    priority: z
      .enum(["low", "medium", "high"])
      .default("medium")
      .describe("Task priority level"),
    due_date: z
      .string()
      .optional()
      .describe("Due date in YYYY-MM-DD format"),
  },
  async ({ title, description, priority, due_date }) => {
    const task: Task = {
      id: generateId("task"),
      title,
      description: description || null,
      priority,
      status: "pending",
      due_date: due_date || null,
      created_at: new Date().toISOString(),
      completed_at: null,
    };

    tasks.set(task.id, task);

    return jsonResult({
      message: \`Task created: "\${title}"\`,
      task,
      tip: "Use list_tasks to see all tasks, or complete_task to mark this done.",
    });
  }
);

server.tool(
  "list_tasks",
  "List all tasks, optionally filtered by status. Use this when someone wants to see their to-do list, check pending items, or review completed work.",
  {
    status: z
      .enum(["pending", "in_progress", "done"])
      .optional()
      .describe("Filter by status (omit to show all)"),
    priority: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe("Filter by priority"),
  },
  async ({ status, priority }) => {
    let filtered = Array.from(tasks.values());

    if (status) filtered = filtered.filter((t) => t.status === status);
    if (priority) filtered = filtered.filter((t) => t.priority === priority);

    // Sort: high priority first, then by creation date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return jsonResult({
      total: filtered.length,
      tasks: filtered.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
      })),
    });
  }
);

server.tool(
  "complete_task",
  "Mark a task as done. Use this when someone has finished a task and wants to mark it complete. After creating tasks with create_task, use this to check them off.",
  {
    task_id: z.string().describe("The task ID (e.g. task_abc12345)"),
  },
  async ({ task_id }) => {
    const task = tasks.get(task_id);

    if (!task) {
      const available = Array.from(tasks.keys());
      return jsonResult({
        error: \`Task "\${task_id}" not found\`,
        available_tasks: available.length > 0 ? available : "No tasks created yet. Use create_task first.",
      });
    }

    if (task.status === "done") {
      return textResult(\`Task "\${task.title}" is already completed.\`);
    }

    task.status = "done";
    task.completed_at = new Date().toISOString();

    const remaining = Array.from(tasks.values()).filter((t) => t.status !== "done").length;

    return jsonResult({
      message: \`✓ Completed: "\${task.title}"\`,
      task,
      remaining_tasks: remaining,
    });
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
