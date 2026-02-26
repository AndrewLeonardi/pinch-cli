<div align="center">
  <h1>pinch</h1>
  <p><strong>Build tools for AI agents. No experience required.</strong></p>

  <a href="https://www.npmjs.com/package/pinch-cli"><img src="https://img.shields.io/npm/v/pinch-cli" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/pinch-cli"><img src="https://img.shields.io/npm/dm/pinch-cli" alt="downloads" /></a>
  <a href="https://github.com/AndrewLeonardi/pinch-cli/blob/main/LICENSE"><img src="https://img.shields.io/github/license/AndrewLeonardi/pinch-cli" alt="license" /></a>
</div>

---

## What is Pinch?

Pinch lets you create tools that AI assistants like Claude and ChatGPT can use. Describe what you want, AI writes the code, and Pinch handles everything else — testing, deploying, hosting.

**You don't need to be a developer.** If you can describe what a tool should do in plain English, you can build one.

### What can you build?

Anything you'd want an AI to do for you:

- Generate invoices, reports, or documents
- Look up data from APIs (weather, stocks, etc.)
- Manage tasks, notes, or projects
- Create party invitations
- Process and analyze data
- ...anything you can describe

---

## Quick Start (5 minutes)

### Prerequisites

You need **Node.js** installed on your computer. If you don't have it:

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the big green button)
3. Run the installer
4. Open your terminal (Terminal on Mac, Command Prompt on Windows)
5. Type `node --version` and press Enter — you should see a version number

### Create Your First Tool

Open your terminal and run:

```bash
npx pinch-cli init my-first-tool
```

> **What's happening?** `npx` downloads and runs Pinch. `init` means "create a new project." `my-first-tool` is the name.

You'll be asked a few questions:

1. **Description** — What does your tool do? (e.g., "Generates greeting messages")
2. **Category** — Pick one from the list
3. **Template** — Start with **Hello World** for your first time

Pinch creates a folder with all the files you need.

### Run It Locally

```bash
cd my-first-tool
npx pinch-cli dev
```

Two things happen:

1. **A browser window opens** with a playground where you can test your tool
2. **Your terminal becomes interactive** — you can type commands to call your tool

Try typing this in the terminal:

```
hello name=World
```

You should see: `Hello, World!`

That's it — you have a working tool!

---

## The AI-First Way to Build (Recommended)

The fastest way to build a tool is to let AI do the coding. Here's how:

### Step 1: Generate a prompt

```bash
npx pinch-cli prompt "a tool that creates party invitations with themes and guest lists"
```

This copies a carefully crafted prompt to your clipboard.

### Step 2: Paste into Claude or ChatGPT

Open your favorite AI assistant and paste the prompt. The AI will generate a complete tool package — a big block of JSON with all the code.

### Step 3: Save the AI's output

Copy the JSON the AI gave you and save it to a file called `package.json` (or any name ending in `.json`).

### Step 4: Import it

```bash
npx pinch-cli import package.json
```

Pinch reads the JSON, creates a full project folder, and installs everything.

### Step 5: Test it

```bash
cd party-invitations
npx pinch-cli dev
```

Your new tool is running! Try it in the browser playground or the terminal REPL.

### Step 6: Deploy it

```bash
npx pinch-cli deploy
```

Pick where you want to host it (more on that below), and your tool is live.

---

## Commands

Here's what each command does:

### `pinch init [name]`

**Creates a new project from a template.**

```bash
npx pinch-cli init my-tool
```

You pick a template, answer a few questions, and get a ready-to-run project. Available templates:

| Template | Best for |
|----------|---------|
| **Hello World** | Learning the basics. One simple tool. |
| **Full Stack** | Tools with a custom web interface (HTML/CSS) |
| **Invoice Tool** | Generating documents with line items and calculations |
| **API Client** | Fetching data from external websites and APIs |
| **Task Manager** | Tools that need to save and retrieve data |
| **Weather Dashboard** | Polished UI with external data (showcase) |
| **AI Chat** | Chat interfaces that wrap AI APIs (showcase) |

### `pinch dev`

**Starts your tool locally for testing.**

```bash
npx pinch-cli dev
```

This does three things:

1. Starts your tool server (usually at `http://localhost:3100`)
2. Opens a browser playground where you can test your tools visually
3. Gives you a terminal REPL (command line) for quick testing

**REPL commands you can type:**

| Command | What it does |
|---------|-------------|
| `list` | Shows all available tools |
| `info <tool>` | Shows what inputs a tool expects |
| `<tool> key=value` | Runs a tool (e.g., `hello name=Alice`) |
| `verbose` | Shows the raw data being sent/received |
| `quit` | Stops the server and exits |

**Useful flags:**

| Flag | What it does |
|------|-------------|
| `--port 3200` | Use a different port (if 3100 is busy) |
| `--no-browser` | Don't auto-open the browser |
| `--verbose` | Show full request/response data |

### `pinch test`

**Checks that everything works correctly.**

```bash
npx pinch-cli test
```

Runs three checks:

1. **Manifest check** — Makes sure your `pinch.toml` config file has all required fields
2. **Tool check** — Starts your server, discovers your tools, calls each one, and verifies the response
3. **Custom tests** — Runs any test cases you've defined in `pinch.toml`

If everything passes, you'll see green checkmarks. If something fails, you'll get a clear error message explaining what's wrong.

### `pinch prompt [description]`

**Generates a prompt you can paste into Claude/ChatGPT to build a tool.**

```bash
npx pinch-cli prompt "a tool that converts currencies"
```

The prompt tells the AI exactly what format to output. You paste it, the AI gives you code, and you import it with `pinch import`.

### `pinch import [file]`

**Turns a JSON tool package into a full project.**

```bash
npx pinch-cli import my-tool.json
```

This is how you take AI-generated code and turn it into a real project with all the files you need.

You can also pipe JSON directly:

```bash
cat ai-output.json | npx pinch-cli import
```

### `pinch export`

**Packages your project into a single JSON file.**

```bash
npx pinch-cli export -o my-tool-backup.json
```

Useful for sharing your project or backing it up. Reverse of `import`.

### `pinch deploy [target]`

**Puts your tool on the internet so anyone (or any AI) can use it.**

```bash
npx pinch-cli deploy
```

You'll be asked where to deploy:

#### Option 1: Cloudflare Workers (Recommended)

Free hosting on Cloudflare's global network. Your tool runs in 300+ cities worldwide.

**First time setup:**
1. Create a free account at [cloudflare.com](https://cloudflare.com)
2. Go to your profile > API Tokens > Create Token
3. Pinch will ask for your token and account ID
4. Credentials are saved for future deploys

**What Pinch handles automatically:**
- Creates the hosting infrastructure
- Sets up databases if your tool needs one
- Sets up storage if your tool saves data
- Deploys your code
- Gives you a live URL

**After deploy, you'll get:**
```
Live URL:     https://my-tool.your-account.workers.dev
MCP endpoint: https://my-tool.your-account.workers.dev/mcp
```

Any AI agent can now use your tool at that URL.

#### Option 2: Docker

Generates files so you can host your tool anywhere — your own server, AWS, Google Cloud, etc.

```bash
npx pinch-cli deploy docker
docker compose up
```

#### Option 3: Pinchers.ai Marketplace

Publish to the [Pinchers.ai](https://pinchers.ai) app store. Other people can discover and use your tool, and **you earn money** when they do.

```bash
npx pinch-cli login
npx pinch-cli deploy pinchers
```

- You set the price (e.g., 5 credits per use)
- You keep 90% of every credit spent
- Payouts via Stripe to your bank account

### `pinch login`

**Connects your terminal to your Pinchers.ai account.**

```bash
npx pinch-cli login
```

Opens a browser window to sign in. After confirming, your terminal is authenticated. You only need to do this once — for publishing tools to the marketplace.

---

## Key Concepts (Explained Simply)

### What is MCP?

**MCP** stands for Model Context Protocol. It's a standard created by Anthropic (the makers of Claude) that lets AI assistants use external tools.

Without MCP, an AI can only chat. With MCP, an AI can actually *do things* — generate invoices, look up weather data, manage your tasks, etc.

When you build a tool with Pinch, you're creating an MCP server. That means Claude, ChatGPT, and other AI assistants can automatically discover and use your tool.

**You don't need to understand how MCP works.** Pinch handles all the protocol stuff. You just define what your tool does.

### What is a "tool"?

A tool is a function that takes some inputs and produces some output. For example:

- **Input:** Client name + amount → **Output:** A professional invoice
- **Input:** City name → **Output:** Current weather data
- **Input:** Party details → **Output:** A beautiful invitation

Each Pinch project can have multiple tools. An "Invoice Generator" project might have tools for `create_invoice`, `add_line_item`, and `calculate_total`.

### What is the Bridge API?

If your tool has a custom web interface (HTML/CSS in the `ui/` folder), the Bridge API is how your frontend talks to your backend.

```javascript
// In your HTML/JavaScript:
const result = await window.pinch.callTool("create_invoice", {
  client: "Acme Corp",
  amount: 2500
});
```

It's one line of code to call any of your tools from a button click, form submit, etc.

### What is Storage?

Some tools need to remember things between uses (like a task list or saved settings). Pinch gives you a simple storage system:

```typescript
await storage.set("my-key", "my-value");    // Save
const value = await storage.get("my-key");   // Load
await storage.delete("my-key");              // Delete
```

Locally, this saves to a file. In production, it uses Cloudflare's global storage. You don't need to set anything up — it just works.

---

## Project Structure

After running `pinch init`, your project folder looks like this:

```
my-tool/
  src/
    tools.ts       ← Your tool logic lives here
    index.ts       ← Dev server (don't need to touch this)
  ui/
    index.html     ← Custom web interface (optional)
  pinch.toml       ← Project settings (name, description, etc.)
  package.json     ← Node.js stuff (managed automatically)
  wrangler.toml    ← Cloudflare config (managed automatically)
  schema.sql       ← Database setup (optional, if you need one)
```

**The only file you really need to care about is `src/tools.ts`.** That's where your tool logic goes. Everything else is configuration that Pinch manages for you.

---

## Adding Tests

You can add test cases to your `pinch.toml` file so `pinch test` verifies your tool works correctly:

```toml
[[test]]
tool = "create_invoice"
input = { client = "Test Corp", amount = 100 }
expect_type = "json"
expect_contains = "Test Corp"

[[test]]
tool = "hello"
input = { name = "Alice" }
expect_contains = "Alice"
```

Each test calls a tool with specific inputs and checks the response. If the response doesn't match expectations, the test fails with a helpful error message.

---

## Typical Workflows

### "I want to build something from scratch"

```bash
npx pinch-cli init my-tool       # Pick a template
cd my-tool
# Edit src/tools.ts if you want to customize
npx pinch-cli dev                # Test locally
npx pinch-cli test               # Make sure it works
npx pinch-cli deploy             # Ship it
```

### "I want AI to build it for me"

```bash
npx pinch-cli prompt "describe your tool here"
# Paste into Claude/ChatGPT, get JSON back
npx pinch-cli import output.json
cd my-tool
npx pinch-cli dev                # Test the AI-generated code
npx pinch-cli deploy             # Ship it
```

### "I want to earn money from my tool"

```bash
# Build your tool (either workflow above)
npx pinch-cli login              # Sign into Pinchers.ai
npx pinch-cli deploy pinchers    # Publish to marketplace
# Set your price, earn 90% of every credit spent
```

---

## Troubleshooting

### "npx pinch-cli" doesn't work

Make sure Node.js is installed: `node --version`. You need version 18 or higher. If it's older, download the latest from [nodejs.org](https://nodejs.org).

### "Port 3100 is already in use"

Another program is using that port. Use a different one:

```bash
npx pinch-cli dev --port 3200
```

### "pinch test" says my manifest is invalid

Open `pinch.toml` and check that all required fields are filled in:
- `name` — Your tool's display name
- `slug` — A URL-friendly version (lowercase, hyphens, no spaces)
- `description` — What your tool does (more than 5 characters)
- `version` — Must be in `X.Y.Z` format (like `1.0.0`)

### "Deploy to Cloudflare failed"

- Make sure your API token has **Workers** permissions
- Double-check your Account ID (find it on the Cloudflare dashboard under Workers & Pages)
- Try reconfiguring: `npx pinch-cli deploy cloudflare --setup`

### My tool works locally but not after deploying

- If your tool uses a database (`schema.sql`), the migration might have failed. Try redeploying.
- If your tool calls external APIs, make sure those APIs don't block requests from Cloudflare Workers.
- Check that you're not using Node.js-only features (Cloudflare Workers run in a different environment).

---

## Contributing

We'd love your help making Pinch better! Here are some ways to contribute:

- **New templates** — Build a cool tool? Turn it into a template for others
- **New deploy targets** — Railway, Fly.io, AWS Lambda, etc.
- **Documentation** — Found something confusing? Help us explain it better
- **Bug reports** — Found a problem? Open an issue on GitHub

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup.

## License

[MIT](./LICENSE) — Use it however you want.
