<p align="center">
  <strong>⚡ pinch</strong>
  <br>
  <em>The fastest way to build MCP servers</em>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> •
  <a href="#what-is-mcp">What is MCP?</a> •
  <a href="#templates">Templates</a> •
  <a href="#deploy">Deploy</a> •
  <a href="#contributing">Contributing</a>
</p>

---

Build, test, and deploy **MCP servers** in under 60 seconds. No boilerplate, no configuration, no PhD required.

```bash
npx pinch-cli init my-tool
cd my-tool && npm install
pinch dev
```

That's it. You now have a working MCP server with a browser playground.

## What is MCP?

**MCP (Model Context Protocol)** is the open standard that lets AI assistants use tools. Think of it as "APIs for AI" — you build the tool, and any AI agent (Claude, ChatGPT, Copilot, etc.) can discover and use it automatically.

```
┌──────────────┐       MCP        ┌──────────────┐
│  AI Agent    │ ──────────────── │  Your Tool   │
│  (Claude,    │   "What tools    │  (built with │
│   ChatGPT,   │    do you have?" │   pinch)     │
│   etc.)      │ ◄────────────── │              │
└──────────────┘   JSON response  └──────────────┘
```

**Why it matters:**

- Every AI company is adopting MCP (Anthropic, OpenAI, Google, Microsoft)
- MCP servers are to AI what REST APIs were to web apps
- Building one is the best way to make your product AI-accessible

**pinch** makes building MCP servers as easy as building a website.

## Quickstart

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- npm (comes with Node.js)

### Create your first MCP server

```bash
# Install globally (optional — npx works too)
npm install -g pinch-cli

# Scaffold a new project
pinch init my-tool

# Install dependencies
cd my-tool && npm install

# Start the dev server with hot reload
pinch dev
```

Your browser opens to a **playground** where you can test your tools in real-time.

### What just happened?

`pinch init` created a project with:

```
my-tool/
├── src/index.ts        ← Your MCP tools (the brain)
├── pinch.toml          ← Tool manifest (name, config)
├── public/             ← Auto-generated playground
├── package.json
└── tsconfig.json
```

The `src/index.ts` file contains your tool definitions:

```typescript
server.tool(
  "hello",                                    // Tool name
  "Say hello to someone",                     // Description (AI reads this)
  { name: z.string().describe("Person") },    // Input schema (Zod)
  async ({ name }) => ({                      // Handler
    content: [{ type: "text", text: `Hello, ${name}!` }],
  })
);
```

That's a complete MCP tool. AI agents can discover it, understand its inputs, and call it.

## Templates

`pinch init` offers 5 starting templates:

| Template | What you get |
|----------|-------------|
| **Starter** | Hello world — simplest possible MCP server |
| **Custom UI** | MCP server + your own frontend with bridge API |
| **Invoice Tool** | Financial calculations with line items and formatting |
| **Data Fetcher** | HTTP client tools for APIs and web scraping |
| **Automation Bot** | Task management with stateful workflows |

### Custom UI (Full-Stack)

Build tools with a visual frontend. The bridge API auto-connects your UI to your MCP backend:

```javascript
// In your ui/index.html
const result = await window.pinch.callTool("create_invoice", {
  client: "Acme Corp",
  amount: 5000,
});
```

Your UI calls MCP tools. No fetch, no endpoints, no CORS — just `callTool()`.

## Commands

| Command | What it does |
|---------|-------------|
| `pinch init [name]` | Create a new MCP server project |
| `pinch dev` | Start dev server with hot reload + playground |
| `pinch test` | Validate manifest + run contract tests |
| `pinch deploy` | Deploy to Cloudflare, Docker, or Pinchers.ai |
| `pinch login` | Authenticate with Pinchers.ai marketplace |
| `pinch publish` | Submit to Pinchers.ai (alias for `deploy pinchers`) |

### `pinch dev` options

```bash
pinch dev                        # Start on default port 3100
pinch dev --port 4000            # Custom port
pinch dev --verbose              # Show full MCP request/response JSON
pinch dev --endpoint http://...  # Connect to external MCP server
pinch dev --no-browser           # Don't auto-open browser
```

The dev server includes an interactive **REPL** for testing tools:

```
⚡ pinch> list
  Available tools: hello, create_invoice

⚡ pinch> hello name=World
  Result (23ms):
  Hello, World!
```

### `pinch test`

Validates your manifest and runs contract tests:

```bash
pinch test
```

Add custom test cases in your `pinch.toml`:

```toml
[[test]]
tool = "create_invoice"
input = { client_name = "Acme Corp", items = '[{"description":"Work","unit_price":500}]' }
expect_contains = "Acme Corp"
```

## Deploy

Ship your MCP server anywhere.

```bash
pinch deploy
```

Interactive prompt lets you pick your target:

### ☁️ Cloudflare Workers (Edge)

Deploy to Cloudflare's global network. Free tier available.

```bash
pinch deploy cloudflare
```

Generates a `wrangler.toml` and instructions. Your MCP server runs at the edge, worldwide.

### 🐳 Docker (Self-Host)

Run anywhere Docker runs — AWS, GCP, Azure, your own server.

```bash
pinch deploy docker
```

Generates `Dockerfile`, `.dockerignore`, and `docker-compose.yml`. Then:

```bash
docker compose up
```

### 🦞 Pinchers.ai (Marketplace)

Publish to [Pinchers.ai](https://pinchers.ai) — a marketplace where users discover and pay for MCP tools. Built-in monetization with a 70/30 revenue split.

```bash
pinch login
pinch deploy pinchers
```

## Manifest Reference

Your `pinch.toml` configures everything:

```toml
[tool]
name = "My Tool"
slug = "my-tool"
description = "What it does"
version = "0.1.0"
category = "Productivity"
tags = ["automation", "tasks"]

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "free"               # or "credits"
# credit_cost = 1           # credits per tool call

[tool.ui]
type = "custom"             # "auto" for playground, "custom" for your own UI
entry = "ui/index.html"

# Optional deploy config
[deploy]
target = "cloudflare"       # default deploy target

# Test cases
[[test]]
tool = "my_tool"
input = { arg = "value" }
expect_contains = "expected"
```

## Bridge API

When you build a Custom UI, `pinch` auto-injects a bridge that connects your frontend to your MCP backend:

```javascript
// Call a tool
const result = await window.pinch.callTool("tool_name", { arg: "value" });

// List available tools
const tools = await window.pinch.listTools();

// Wait for MCP connection
await window.pinch.ready;

// Design tokens
const { primary, bg, bgCard } = window.pinch.theme.colors;
const { sans, mono } = window.pinch.theme.fonts;
```

## Storage API

Tools can persist data using the built-in storage API:

```typescript
// In your tool handlers (src/index.ts)
await storage.set("users", [{ name: "Alice" }]);
const users = await storage.get("users");
await storage.delete("users");
const keys = await storage.keys("user_");
```

Locally: saves to `.pinch-data.json`. In production: uses Cloudflare KV automatically.

## Building with AI

The fastest way to build an MCP server is to describe what you want to an AI assistant:

```
I want to build an MCP server that manages a todo list.
It should have tools for: create_task, list_tasks, complete_task, delete_task.
Tasks should have a title, priority (low/medium/high), and due date.
```

The **Custom UI** template includes a "Build with AI" workflow that generates a ready-to-paste prompt with all the APIs documented.

## Contributing

We welcome contributions! Here's how to get started:

```bash
git clone https://github.com/AndrewLeonardi/pinch-cli.git
cd pinch-cli
npm install
npm run dev        # watch mode
```

### Development

```bash
# Build
npm run build

# Test locally (link the CLI)
npm link
pinch init test-tool

# Run from source
node dist/index.js init test-tool
```

### Ideas for contributions

- **New templates** — Build a template for a common use case (email, calendar, CRM, etc.)
- **Deploy targets** — Add support for AWS Lambda, Fly.io, Railway, etc.
- **Better playground** — Improve the auto-generated testing UI
- **Documentation** — Tutorials, guides, video walkthroughs

## License

MIT — do whatever you want with it.

---

<p align="center">
  <strong>Built by <a href="https://pinchers.ai">Pinchers.ai</a></strong>
  <br>
  <em>The MCP tool marketplace</em>
</p>
