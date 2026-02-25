<div align="center">
  <h1>pinch</h1>
  <p><strong>Build, test, and deploy MCP servers with custom frontends — from your terminal.</strong></p>

  <a href="https://www.npmjs.com/package/pinch-cli"><img src="https://img.shields.io/npm/v/pinch-cli" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/pinch-cli"><img src="https://img.shields.io/npm/dm/pinch-cli" alt="downloads" /></a>
  <a href="https://github.com/AndrewLeonardi/pinch-cli/blob/main/LICENSE"><img src="https://img.shields.io/github/license/AndrewLeonardi/pinch-cli" alt="license" /></a>
  <a href="https://github.com/AndrewLeonardi/pinch-cli/actions"><img src="https://img.shields.io/github/actions/workflow/status/AndrewLeonardi/pinch-cli/ci.yml" alt="CI" /></a>
</div>

---

## Quick Start

```bash
npx pinch-cli init my-tool
cd my-tool
pinch dev
```

That's it. You have a running MCP server with a playground UI at `http://localhost:3100`.

## What is Pinch?

Pinch is the fastest way to go from an idea to a deployed MCP server. It handles scaffolding, local development, testing, and one-command deployment to Cloudflare Workers — with optional custom frontends, databases, and storage.

**MCP** (Model Context Protocol) is the standard for giving AI agents tools. Every MCP server you build with Pinch can be used by Claude, ChatGPT, and any MCP-compatible AI client.

## Why Pinch?

| Without Pinch | With Pinch |
|---------------|-----------|
| Write MCP server code from scratch | `pinch init` — pick a template, start coding |
| Build a separate frontend | Templates include UI + bridge API built-in |
| Figure out Cloudflare/AWS deployment | `pinch deploy` — one command, auto-provisions everything |
| Manually provision D1 databases | Auto-detected from your code, provisioned on deploy |
| Set up KV storage yourself | `storage.get/set` — just works locally and in production |
| No way to test MCP compliance | `pinch test` — validates manifest + runs contract tests |
| JSON-RPC debugging in curl | `pinch dev` — interactive REPL + browser playground |

## Features

- **7 starter templates** — Hello World, Full Stack (with UI), Invoice Tool, API Client, Task Manager, Weather Dashboard, AI Chat
- **Custom frontends** — Add a `ui/` directory with HTML/CSS/JS or React/Vue/Svelte. The bridge API (`window.pinch.callTool()`) connects your UI to MCP tools
- **AI-first workflow** — Run `pinch prompt`, paste into Claude/ChatGPT, get back a complete tool package, import with `pinch import`
- **One-command deploy** — `pinch deploy` ships to Cloudflare Workers with auto-provisioned D1 databases, KV storage, and Durable Objects
- **Built-in testing** — `pinch test` validates your manifest, initializes MCP sessions, and contract-tests every tool
- **Interactive REPL** — `pinch dev` gives you a playground UI + terminal REPL for calling tools
- **Docker support** — `pinch deploy docker` generates Dockerfile + docker-compose for self-hosting
- **Optional marketplace** — `pinch deploy pinchers` publishes to [Pinchers.ai](https://pinchers.ai) with built-in monetization (90/10 creator split)

## Commands

| Command | Description |
|---------|------------|
| `pinch init [name]` | Create a new MCP server project from a template |
| `pinch dev` | Start local dev server with hot reload, playground UI, and REPL |
| `pinch test` | Validate manifest + run contract tests against your tools |
| `pinch deploy [target]` | Deploy to Cloudflare Workers, Docker, or Pinchers.ai |
| `pinch import [file]` | Import a JSON tool package (from AI output) into a project |
| `pinch export` | Export current project as a portable JSON package |
| `pinch prompt [description]` | Generate an AI prompt for building a new tool |
| `pinch login` | Authenticate with Pinchers.ai (optional, for marketplace) |

## How It Works

### The AI-First Workflow

The fastest path from idea to deployed tool:

```
1. pinch prompt "a tool that generates invoices"
2. Paste the prompt into Claude/ChatGPT
3. AI outputs a JSON package
4. pinch import package.json
5. pinch dev          # test locally
6. pinch deploy       # ship to production
```

### The Traditional Workflow

```
1. pinch init my-tool       # scaffold from template
2. Edit src/tools.ts        # add your MCP tools
3. Edit ui/index.html       # customize the frontend (optional)
4. pinch dev                # develop with hot reload
5. pinch test               # validate everything works
6. pinch deploy cloudflare  # deploy to the edge
```

### What Gets Deployed

When you run `pinch deploy cloudflare`, Pinch:

1. Reads your `src/tools.ts` and detects what infrastructure you need
2. If you use `storage.get/set` — provisions a Cloudflare KV namespace
3. If you use `env.DB` — provisions a Cloudflare D1 database
4. If you have `schema.sql` — runs the migration on D1
5. Generates a Cloudflare Worker with Durable Objects for multi-session MCP
6. Deploys with `wrangler` and gives you a live URL

The entire process takes about 15 seconds.

## Templates

### Hello World
Minimal MCP server with a single tool. Start here to learn the basics.

### Full Stack
MCP server + custom HTML/CSS frontend connected via the bridge API. Includes the "Build with AI" workflow for generating tools with LLMs.

### Invoice Tool
A real-world tool that generates professional invoices with line items, tax calculations, and discounts.

### API Client
HTTP tools for fetching JSON, scraping text, and checking URLs. Shows how to make external API calls from MCP tools.

### Task Manager
Full CRUD operations with persistent storage. Demonstrates `storage.get/set/delete/keys` for stateful tools.

### Weather Dashboard
Showcase template with a polished UI featuring weather data display. Demonstrates external API integration + UI bridge.

### AI Chat
Chat interface template that wraps LLM API calls. Demonstrates streaming, session state, and the bridge API.

## Bridge API

When you add a `ui/` directory, Pinch automatically injects the bridge script into your HTML. Your frontend code gets access to:

```javascript
// Call an MCP tool
const result = await window.pinch.callTool("generate_invoice", {
  client: "Acme Corp",
  amount: 1500
});

// List available tools
const tools = await window.pinch.listTools();

// Save an artifact (shareable output)
await window.pinch.saveArtifact({
  type: "invoice",
  data: invoiceData,
  label: "Invoice #1234"
});

// File storage (paid tools only)
await window.pinch.uploadFile(file, "receipts/january.pdf");
const url = window.pinch.getFileUrl("receipts/january.pdf");

// Theme tokens for consistent styling
const { colors, fonts } = window.pinch.theme;
```

## Storage

Pinch provides a simple key-value storage API that works the same locally and in production:

```typescript
// In your tools.ts
export function registerTools(server: McpServer, storage: Storage) {
  server.tool("save_note", { title: z.string(), body: z.string() }, async ({ title, body }) => {
    await storage.set(`notes:${title}`, JSON.stringify({ title, body, created: Date.now() }));
    return { content: [{ type: "text", text: `Saved "${title}"` }] };
  });
}
```

- **Local dev**: Stores in `.pinch-data.json` (auto-created)
- **Cloudflare**: Uses KV namespace (auto-provisioned on deploy)

## Deploying

### Cloudflare Workers (recommended)

```bash
pinch deploy cloudflare
```

First run prompts for your Cloudflare API token and Account ID. Credentials are saved to `~/.pinchrc` for future deploys.

### Docker

```bash
pinch deploy docker
```

Generates `Dockerfile`, `.dockerignore`, and `docker-compose.yml`. Build and run anywhere.

### Pinchers.ai Marketplace

```bash
pinch login
pinch deploy pinchers
```

Publishes your tool to the [Pinchers.ai](https://pinchers.ai) marketplace with:
- Credit-based monetization (you set the price per use)
- 90/10 revenue split (creator gets 90%)
- Stripe Connect payouts ($50 minimum)
- Built-in user management, analytics, and MCP proxy

## Testing

```bash
pinch test
```

Runs three phases:

1. **Manifest validation** — checks `pinch.toml` for required fields, valid slug, semver, etc.
2. **Contract tests** — starts your server, initializes MCP session, discovers tools, calls each with minimal inputs
3. **Custom tests** — runs `[[test]]` blocks from your `pinch.toml`

Add custom test cases to your manifest:

```toml
[[test]]
tool = "generate_invoice"
input = { client = "Test Corp", amount = 100 }
expect_type = "json"
expect_contains = "Test Corp"
```

## Configuration

### pinch.toml (project manifest)

```toml
[tool]
name = "My Cool Tool"
slug = "my-cool-tool"
description = "Does something amazing"
version = "1.0.0"
category = "productivity"
tags = ["ai", "automation"]

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "free"  # or "credits" with credit_cost = 5
```

### ~/.pinchrc (global config)

Stores authentication and deployment credentials. Created automatically by `pinch login` and `pinch deploy`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines. PRs welcome!

Ideas for contributions:
- New project templates
- New deploy targets (Railway, Fly.io, AWS Lambda)
- Bridge API extensions
- Documentation improvements

## License

[MIT](./LICENSE)
