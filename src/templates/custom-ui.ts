import { getPlaygroundHtml } from "./playground.js";
import { generateServerCode } from "./server-runtime.js";

export function customUITemplate(
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
category = "${category}"
tags = []

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "credits"
credit_cost = 1

[tool.ui]
type = "custom"
entry = "ui/index.html"

[[test]]
tool = "save_item"
input = { name = "Test", message = "Hello world" }
expect_contains = "success"

[[test]]
tool = "list_items"
input = {}
expect_contains = "items"
`;

  const serverCode = generateServerCode({
    name,
    tools: `  // ─── YOUR TOOLS ─────────────────────────────────────────
  //
  // Each server.tool() creates an MCP endpoint.
  // Your UI calls them via: window.pinchers.callTool("tool_name", { arg: value })
  //
  // PATTERN:
  //   server.tool(
  //     "name",                   <- tool name (what your UI calls)
  //     "description",            <- shown in playground + marketplace
  //     { arg: z.string() },      <- input schema (uses Zod)
  //     async ({ arg }) => {      <- handler function
  //       return { content: [{ type: "text", text: JSON.stringify(result) }] };
  //     }
  //   );
  //
  // STORAGE (persistent data that survives restarts):
  //   await storage.get("key")        -> returns stored value or null
  //   await storage.set("key", value) -> saves any JSON-serializable value
  //   await storage.delete("key")     -> removes a key
  //   await storage.keys("prefix")    -> list all keys (optionally by prefix)
  //
  // Locally this saves to .pinchers-data.json.
  // In production it uses Cloudflare KV automatically.

  // ── Example: save an item ──────────────────────────────
  server.tool(
    "save_item",
    "Save an item with a name and message",
    {
      name: z.string().describe("Name of the item"),
      message: z.string().describe("The message or content"),
    },
    async ({ name, message }) => {
      const items: any[] = (await storage.get("items")) || [];
      const item = {
        id: "item_" + Math.random().toString(36).slice(2, 10),
        name,
        message,
        created_at: new Date().toISOString(),
      };
      items.push(item);
      await storage.set("items", items);

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, item }, null, 2) }],
      };
    }
  );

  // ── Example: list all items ────────────────────────────
  server.tool(
    "list_items",
    "List all saved items",
    {},
    async () => {
      const items = (await storage.get("items")) || [];
      return {
        content: [{ type: "text", text: JSON.stringify({ items, count: items.length }, null, 2) }],
      };
    }
  );

  // ── Example: delete an item ────────────────────────────
  server.tool(
    "delete_item",
    "Delete an item by its ID",
    {
      id: z.string().describe("The item ID to delete"),
    },
    async ({ id }) => {
      const items: any[] = (await storage.get("items")) || [];
      const idx = items.findIndex((i: any) => i.id === id);
      if (idx === -1) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }] };
      }
      const deleted = items.splice(idx, 1)[0];
      await storage.set("items", items);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, deleted }, null, 2) }],
      };
    }
  );`,
  });

  // ── UI: interactive getting-started guide ──────────────
  const uiHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app">
    <header class="header">
      <h1>${name}</h1>
      <span class="status" id="status">Connecting...</span>
    </header>

    <!-- Welcome -->
    <section class="card welcome-card">
      <div class="welcome-hero">
        <span class="welcome-emoji">\u{1F99E}</span>
        <div>
          <h2 class="welcome-title">Your Pincher is ready!</h2>
          <p class="welcome-subtitle">${description}</p>
        </div>
      </div>

      <p class="welcome-text">A <strong>Pincher</strong> is a mini web app that anyone can use right in their browser \u2014 no downloads, no installs needed.</p>

      <div class="welcome-parts">
        <div class="welcome-part">
          <span class="part-icon">\u2699\uFE0F</span>
          <div>
            <strong>Backend</strong>
            <span>The "brain" \u2014 your tool's logic, data, and smarts</span>
          </div>
        </div>
        <div class="welcome-part">
          <span class="part-icon">\u{1F3A8}</span>
          <div>
            <strong>Frontend</strong>
            <span>The "face" \u2014 what people see and interact with</span>
          </div>
        </div>
      </div>

      <p class="welcome-cta">Right now this is a starter template. Let's turn it into <strong>your</strong> tool \u{1F447}</p>
    </section>

    <!-- Build section -->
    <section class="card build-card">
      <div class="path-tabs">
        <button class="path-tab active" onclick="showPath('ai')">Build with AI \u2728</button>
        <button class="path-tab" onclick="showPath('manual')">Build Manually</button>
      </div>

      <!-- AI Path -->
      <div id="path-ai" class="path-content active">
        <p class="ai-intro-text">Describe what you want in plain English, and let AI write all the code for you. Works with <strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>ChatGPT</strong>, or any AI assistant.</p>

        <div class="ai-form">
          <div class="ai-field">
            <label for="project-path">Your Project Location</label>
            <div class="path-field-row">
              <input type="text" id="project-path" readonly class="path-input">
              <span class="path-auto-badge">\u2713 Auto-detected</span>
            </div>
            <span class="field-hint">This is where your project files live. It's already filled in for you!</span>
          </div>

          <div class="ai-field">
            <label for="tool-description">What should your tool do?</label>
            <textarea id="tool-description" rows="5" placeholder="e.g. A party invite tool that lets me create beautiful invitations with a title, date, time, and location. Guests get a link to RSVP, and I can see a list of who's coming vs who declined."></textarea>
            <span class="field-hint">Be as detailed as you want \u2014 the more you describe, the better the result!</span>
          </div>

          <button class="btn-copy-prompt" id="copy-btn" onclick="copyAIPrompt()">
            \u{1F4CB} Copy AI Prompt
          </button>
          <div id="copy-feedback" class="copy-feedback"></div>
        </div>

        <div class="ai-steps">
          <h3 class="steps-title">How it works</h3>
          <div class="ai-step">
            <span class="step-num">1</span>
            <span>Fill in what you want above, then hit <strong>Copy AI Prompt</strong></span>
          </div>
          <div class="ai-step">
            <span class="step-num">2</span>
            <span>Open your AI assistant and <strong>paste</strong> the prompt</span>
          </div>
          <div class="ai-step">
            <span class="step-num">3</span>
            <span>The AI edits your files \u2014 <strong>refresh this page</strong> to see your tool!</span>
          </div>
          <div class="ai-step">
            <span class="step-num">4</span>
            <span>Happy with it? Run <code>pinch login</code> then <code>pinch publish</code> to go live</span>
          </div>
        </div>
      </div>

      <!-- Manual Path -->
      <div id="path-manual" class="path-content">
        <div class="step">
          <span class="step-num">1</span>
          <div>
            <strong>Add your backend tools</strong>
            <p>Open <code>src/index.ts</code> and find the <code>server.tool()</code> calls.
               Replace the examples with your own tools. Each tool gets a name, input schema (Zod), and handler function.</p>
          </div>
        </div>

        <div class="step">
          <span class="step-num">2</span>
          <div>
            <strong>Build your UI</strong>
            <p>Edit <code>ui/index.html</code> and <code>ui/styles.css</code>.
               Call your tools from JavaScript with:</p>
            <pre>const result = await window.pinchers.callTool("your_tool", { arg: "value" });</pre>
          </div>
        </div>

        <div class="step">
          <span class="step-num">3</span>
          <div>
            <strong>Use persistent storage</strong>
            <p>Need to save data? Use <code>storage</code> in your tool handlers:</p>
            <pre>await storage.set("mydata", { items: [...] });
const data = await storage.get("mydata");</pre>
          </div>
        </div>

        <div class="step">
          <span class="step-num">4</span>
          <div>
            <strong>Publish to Pinchers</strong>
            <p>When you're happy, run <code>pinch login</code> then <code>pinch publish</code>
               to submit it to the marketplace.</p>
          </div>
        </div>

        <details class="api-details">
          <summary>API Reference</summary>
          <div class="api-ref">
            <div class="api-item">
              <code>await window.pinchers.callTool(name, args)</code>
              <span>Call an MCP tool and get the result</span>
            </div>
            <div class="api-item">
              <code>await window.pinchers.listTools()</code>
              <span>Discover all available tools + their input schemas</span>
            </div>
            <div class="api-item">
              <code>window.pinchers.ready</code>
              <span>Promise \u2014 resolves when the MCP connection is established</span>
            </div>
            <div class="api-item">
              <code>window.pinchers.theme</code>
              <span>Pinchers design tokens (colors, fonts)</span>
            </div>
          </div>
        </details>
      </div>
    </section>
  </div>

  <script>
    // \u2500\u2500 Connection status \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    function markConnected() {
      document.getElementById("status").textContent = "Connected";
      document.getElementById("status").classList.add("connected");
    }
    if (window.pinchers && window.pinchers.ready) {
      window.pinchers.ready.then(markConnected).catch(function() {});
    }
    document.addEventListener("pinchers:ready", markConnected);

    // \u2500\u2500 Auto-fill project path \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    (function() {
      var pathEl = document.getElementById("project-path");
      if (window.__pinchers_path) {
        pathEl.value = window.__pinchers_path;
      } else {
        pathEl.value = "(path will auto-fill when server starts)";
      }
    })();

    // \u2500\u2500 Path switcher \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    window.showPath = function(which) {
      document.querySelectorAll(".path-tab").forEach(function(t) { t.classList.remove("active"); });
      document.querySelectorAll(".path-content").forEach(function(c) { c.classList.remove("active"); });
      document.getElementById("path-" + which).classList.add("active");
      event.target.classList.add("active");
    };

    // \u2500\u2500 Copy AI prompt (assembled from form) \u2500\u2500\u2500\u2500\u2500
    window.copyAIPrompt = function() {
      var path = document.getElementById("project-path").value || "(your project path)";
      var desc = document.getElementById("tool-description").value;

      if (!desc.trim()) {
        document.getElementById("tool-description").focus();
        document.getElementById("tool-description").classList.add("shake");
        setTimeout(function() { document.getElementById("tool-description").classList.remove("shake"); }, 600);
        return;
      }

      var prompt = "I'm building a Pinchers.ai MCP tool. Here's the project and all the APIs you need:\\n\\n" +
        "PROJECT: " + document.title + "\\n" +
        "PATH: " + path + "\\n\\n" +
        "WHAT I WANT TO BUILD:\\n" + desc + "\\n\\n" +
        "FILES TO EDIT:\\n" +
        "- src/index.ts \\u2014 Backend tool handlers (this is where your tool logic goes)\\n" +
        "- ui/index.html \\u2014 Frontend UI (what users see)\\n" +
        "- ui/styles.css \\u2014 Styles (how it looks)\\n" +
        "- pinchers.toml \\u2014 Tool config (update name and description to match)\\n\\n" +
        "BACKEND API (src/index.ts):\\n" +
        "Each tool is defined with server.tool(name, description, zodSchema, handler).\\n" +
        "Return format: { content: [{ type: \\"text\\", text: JSON.stringify(result) }] }\\n" +
        "Zod is imported as z. Types: z.string(), z.number(), z.boolean(), z.enum([...]), z.array(), z.object().\\n" +
        "z.string().describe(\\"hint\\") adds a description for the field.\\n\\n" +
        "PERSISTENT STORAGE (available in tool handlers \\u2014 data survives restarts):\\n" +
        "await storage.get(\\"key\\")        \\u2192 returns stored value or null\\n" +
        "await storage.set(\\"key\\", value) \\u2192 saves any JSON value\\n" +
        "await storage.delete(\\"key\\")     \\u2192 removes a key\\n" +
        "await storage.keys(\\"prefix\\")    \\u2192 list keys\\n\\n" +
        "FRONTEND API (ui/index.html \\u2014 bridge is auto-injected, just use it):\\n" +
        "await window.pinchers.callTool(\\"tool_name\\", { arg: \\"value\\" }) \\u2192 calls a backend tool\\n" +
        "await window.pinchers.listTools() \\u2192 discover available tools\\n" +
        "window.pinchers.ready \\u2192 promise, resolves when connected\\n" +
        "window.pinchers.theme.colors \\u2192 { lobsterRed, bg, bgCard, border, textPrimary, textSecondary }\\n" +
        "window.pinchers.theme.fonts \\u2192 { sans, mono }\\n\\n" +
        "DESIGN SYSTEM: DM Sans font, background #f0ece4, accent red #e8503a, border-radius 16px, borders #d9d3c7, cards white #ffffff.\\n\\n" +
        "IMPORTANT:\\n" +
        "- Replace ALL the example tools in src/index.ts with the real ones for this tool\\n" +
        "- Build a complete, polished UI in ui/index.html + ui/styles.css\\n" +
        "- The dev server has hot-reload \\u2014 just save files and refresh the browser\\n" +
        "- Update pinchers.toml name and description to match the tool";

      navigator.clipboard.writeText(prompt).then(function() {
        var feedback = document.getElementById("copy-feedback");
        feedback.textContent = "\\u2713 Copied! Now paste it into your AI assistant.";
        feedback.classList.add("show");
        setTimeout(function() { feedback.classList.remove("show"); }, 5000);

        var btn = document.getElementById("copy-btn");
        btn.textContent = "\\u2713 Copied!";
        btn.classList.add("copied");
        setTimeout(function() {
          btn.textContent = "\\u{1F4CB} Copy AI Prompt";
          btn.classList.remove("copied");
        }, 3000);
      });
    };
  </script>
</body>
</html>`;

  const uiCss = `/* ── Pinchers Design System ────────────────────────── */

:root {
  --red: #e8503a;
  --bg: #f0ece4;
  --bg-card: #ffffff;
  --border: #d9d3c7;
  --text: #2a2a2a;
  --text-secondary: #6b6560;
  --text-muted: #9e9790;
  --green: #2a9d6e;
  --radius: 16px;
  --radius-sm: 10px;
  --font: 'DM Sans', system-ui, sans-serif;
  --mono: 'JetBrains Mono', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

.app {
  max-width: 680px;
  margin: 0 auto;
  padding: 28px 20px 60px;
}

/* ── Header ─────────────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.header h1 { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; }
.status {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 12px;
  border-radius: 100px;
  background: rgba(0,0,0,0.04);
  color: var(--text-muted);
}
.status.connected { background: rgba(42,157,110,0.08); color: var(--green); }

/* ── Cards ──────────────────────────────────────── */
.card {
  background: var(--bg-card);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  padding: 28px;
  margin-bottom: 16px;
}

/* ── Welcome Card ──────────────────────────────── */
.welcome-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.welcome-emoji {
  font-size: 2.2rem;
  flex-shrink: 0;
}
.welcome-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 2px;
}
.welcome-subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
}
.welcome-text {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}
.welcome-parts {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.welcome-part {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 14px;
  background: var(--bg);
  border-radius: var(--radius-sm);
}
.part-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
  line-height: 1;
}
.welcome-part strong {
  display: block;
  font-size: 0.82rem;
  margin-bottom: 2px;
}
.welcome-part span {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.4;
}
.welcome-cta {
  font-size: 0.88rem;
  color: var(--text-secondary);
  text-align: center;
  padding-top: 4px;
}

/* ── Path Switcher ──────────────────────────────── */
.path-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  padding: 4px;
}
.path-tab {
  flex: 1;
  padding: 11px 16px;
  font-family: var(--font);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.path-tab:hover { color: var(--text); }
.path-tab.active {
  background: var(--bg-card);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.path-content { display: none; }
.path-content.active { display: block; }

/* ── AI Path ───────────────────────────────────── */
.ai-intro-text {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 20px;
}
.ai-intro-text strong { color: var(--text); }

.ai-form {
  margin-bottom: 28px;
}
.ai-field {
  margin-bottom: 18px;
}
.ai-field label {
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin-bottom: 6px;
}
.path-field-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.path-input {
  flex: 1;
  padding: 10px 14px;
  font-family: var(--mono);
  font-size: 0.8rem;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: #faf8f4;
  color: var(--text-secondary);
  outline: none;
}
.path-auto-badge {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--green);
  white-space: nowrap;
  flex-shrink: 0;
}
.field-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 5px;
  line-height: 1.4;
}
.ai-field textarea {
  width: 100%;
  padding: 12px 14px;
  font-family: var(--font);
  font-size: 0.88rem;
  line-height: 1.5;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: #faf8f4;
  color: var(--text);
  outline: none;
  resize: vertical;
  min-height: 120px;
  transition: border-color 0.15s;
}
.ai-field textarea:focus {
  border-color: var(--red);
}
.ai-field textarea::placeholder {
  color: var(--text-muted);
  font-size: 0.84rem;
}

.btn-copy-prompt {
  display: block;
  width: 100%;
  padding: 14px 24px;
  font-family: var(--font);
  font-size: 1rem;
  font-weight: 700;
  color: white;
  background: var(--red);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.btn-copy-prompt:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-copy-prompt.copied { background: var(--green); }

.copy-feedback {
  text-align: center;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--green);
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.3s;
}
.copy-feedback.show { opacity: 1; }

/* shake animation for empty description */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
.shake { animation: shake 0.4s ease; }

/* ── AI Steps ──────────────────────────────────── */
.steps-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.ai-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}
.step-num {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--red);
  color: white;
  font-weight: 800;
  font-size: 0.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}
.ai-step code {
  font-family: var(--mono);
  font-size: 0.78rem;
  color: var(--red);
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
}

/* ── Manual Path ───────────────────────────────── */
.step {
  display: flex;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}
.step:last-of-type { border-bottom: none; }
.step strong { font-size: 0.92rem; display: block; margin-bottom: 4px; }
.step p { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; }
.step code {
  font-family: var(--mono);
  font-size: 0.78rem;
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--red);
}
.step pre {
  font-family: var(--mono);
  font-size: 0.75rem;
  background: var(--bg);
  padding: 10px 14px;
  border-radius: 8px;
  margin-top: 8px;
  line-height: 1.6;
  overflow-x: auto;
}

/* ── API Reference ──────────────────────────────── */
.api-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.api-details summary {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  margin-bottom: 12px;
}
.api-ref { display: flex; flex-direction: column; gap: 8px; }
.api-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: var(--bg);
  border-radius: 8px;
}
.api-item code {
  font-family: var(--mono);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}
.api-item span { font-size: 0.75rem; color: var(--text-muted); }

/* ── Responsive ─────────────────────────────────── */
@media (max-width: 600px) {
  .welcome-parts { flex-direction: column; }
  .path-tabs { flex-direction: column; }
  .path-field-row { flex-direction: column; align-items: stretch; }
  .path-auto-badge { text-align: right; }
}
`;

  // ── README ─────────────────────────────────────────────
  const readme = `# ${name}

${description}

## Quick Start

\`\`\`bash
npm install
npm run dev       # starts on http://localhost:3100
\`\`\`

## Project Structure

\`\`\`
${slug}/
  src/index.ts        <- Your MCP tools (backend logic)
  ui/index.html       <- Your custom UI (frontend)
  ui/styles.css       <- Your styles
  pinchers.toml       <- Tool manifest (name, pricing, category)
  public/             <- Fallback playground (auto-generated)
\`\`\`

## Building Your Tool

### 1. Add tools in \`src/index.ts\`

Find the \`server.tool()\` calls inside \`createToolServer()\`. Each tool has:
- **name** — what your UI calls via \`callTool("name", args)\`
- **description** — shown in the marketplace
- **schema** — input validation using [Zod](https://zod.dev)
- **handler** — your async function that returns a result

\`\`\`typescript
server.tool(
  "my_tool",
  "Description of what it does",
  {
    input_field: z.string().describe("What this field is for"),
    count: z.number().default(5).describe("How many"),
  },
  async ({ input_field, count }) => {
    // Your logic here
    const result = { message: "Hello " + input_field, count };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);
\`\`\`

### 2. Use persistent storage

Need to save data between calls? Use \`storage\`:

\`\`\`typescript
// Save data
await storage.set("users", [{ name: "Alice" }, { name: "Bob" }]);

// Read data
const users = await storage.get("users"); // returns the array, or null

// Delete data
await storage.delete("users");

// List keys
const keys = await storage.keys("user_"); // all keys starting with "user_"
\`\`\`

This saves to a local JSON file during development. In production (after publishing),
it automatically uses Cloudflare KV — no changes needed.

### 3. Build your UI in \`ui/index.html\`

The Pinchers bridge is auto-injected. Use it in your JavaScript:

\`\`\`javascript
// Call a tool
const result = await window.pinchers.callTool("my_tool", {
  input_field: "world",
  count: 3,
});

// List available tools (useful for debugging)
const tools = await window.pinchers.listTools();

// Wait for connection before doing anything
await window.pinchers.ready;

// Access Pinchers design tokens
const { lobsterRed, bg } = window.pinchers.theme.colors;
const { sans, mono } = window.pinchers.theme.fonts;
\`\`\`

### 4. Test locally

\`\`\`bash
npm run dev       # Start dev server with hot-reload
pinch test        # Run automated tests from pinchers.toml
\`\`\`

### 5. Publish

\`\`\`bash
pinch login       # Authenticate with Pinchers
pinch publish     # Submit for review
\`\`\`

## Manifest Reference (\`pinchers.toml\`)

\`\`\`toml
[tool]
name = "My Tool"           # Display name
slug = "my-tool"           # URL-safe identifier
description = "..."        # Short description
category = "Productivity"  # Browse category
tags = ["tag1", "tag2"]    # Search tags
version = "0.1.0"

[tool.pricing]
type = "credits"           # "credits" or "free"
credit_cost = 1            # Credits per tool call

[tool.ui]
type = "custom"            # "custom" = your own UI
entry = "ui/index.html"    # Entry point
\`\`\`
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
    "ui/index.html": uiHtml,
    "ui/styles.css": uiCss,
    "public/playground.html": getPlaygroundHtml(name, description),
    "package.json": pkg,
    "tsconfig.json": tsconfig,
    "README.md": readme,
    ".gitignore": "node_modules/\ndist/\n.env\n.pinchers-data.json\n",
  };
}
