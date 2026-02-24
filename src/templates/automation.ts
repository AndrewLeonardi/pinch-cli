import { getPlaygroundHtml } from "./playground.js";
import { generateToolsFile, generateDevServer, getPackageJson, getTsConfig, getGitignore, getEnvExample, getReadme } from "./server-runtime.js";
import { generateWranglerConfig } from "../lib/worker-gen.js";

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

  const toolsCode = generateToolsFile({
    helpers: `function generateId(prefix: string): string {
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
}`,

    state: `interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done";
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

const tasks = new Map<string, Task>();`,

    tools: `  server.tool(
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
