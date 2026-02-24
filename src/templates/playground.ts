/**
 * Generates a self-contained HTML playground for testing MCP tools.
 * Served at GET / by the scaffolded MCP server.
 *
 * Features:
 * - Auto-discovers tools via tools/list
 * - Generates forms from inputSchema
 * - Calls tools and renders pretty JSON output
 * - Connection status indicator with auto-retry
 * - Clean design system (DM Sans, rounded cards)
 */

export function getPlaygroundHtml(name: string, description: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} — Pinch Playground</title>
  <link rel="icon" type="image/png" href="data:image/png;base64,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" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --lobster-red: #e8503a;
      --lobster-red-hover: #d4432f;
      --bg: #f0ece4;
      --bg-card: #ffffff;
      --border: #d9d3c7;
      --text-primary: #1a1a1a;
      --text-secondary: #6b6560;
      --text-dim: #9e9791;
      --green: #22c55e;
      --red: #ef4444;
      --blue: #3b82f6;
      --radius: 16px;
      --radius-sm: 12px;
      --radius-pill: 24px;
      --shadow: 0 1px 3px rgba(0,0,0,0.06);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
    }

    body {
      font-family: "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 32px 24px;
    }

    /* ── Header ──────────────────────────── */

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 32px;
    }

    .header-left h1 {
      font-size: 24px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-left h1 .lobster { font-size: 28px; }

    .header-left p {
      color: var(--text-secondary);
      font-size: 15px;
      margin-top: 4px;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      background: var(--bg-card);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--red);
      transition: background 0.3s;
    }

    .status-dot.connected { background: var(--green); }

    .status-text { color: var(--text-secondary); }

    /* ── Tool Tabs ───────────────────────── */

    .tool-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .tool-tab {
      padding: 8px 18px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border);
      background: var(--bg-card);
      cursor: pointer;
      font-family: "JetBrains Mono", monospace;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      transition: all 0.15s;
      box-shadow: var(--shadow);
    }

    .tool-tab:hover {
      border-color: var(--lobster-red);
      color: var(--lobster-red);
    }

    .tool-tab.active {
      background: var(--lobster-red);
      border-color: var(--lobster-red);
      color: white;
    }

    /* ── Cards ────────────────────────────── */

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-dim);
    }

    .tool-name {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .tool-desc {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 20px;
    }

    /* ── Form Fields ─────────────────────── */

    .field {
      margin-bottom: 16px;
    }

    .field-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--text-primary);
    }

    .field-label .required {
      color: var(--lobster-red);
      margin-left: 2px;
    }

    .field-label .type-badge {
      font-family: "JetBrains Mono", monospace;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-dim);
      margin-left: 8px;
    }

    .field-hint {
      font-size: 12px;
      color: var(--text-dim);
      margin-top: 4px;
    }

    .field input[type="text"],
    .field input[type="number"],
    .field textarea,
    .field select {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-family: "DM Sans", sans-serif;
      font-size: 14px;
      color: var(--text-primary);
      background: white;
      transition: border-color 0.15s;
      outline: none;
    }

    .field input:focus,
    .field textarea:focus,
    .field select:focus {
      border-color: var(--lobster-red);
    }

    .field textarea {
      min-height: 80px;
      resize: vertical;
      font-family: "JetBrains Mono", monospace;
      font-size: 13px;
    }

    .field-checkbox {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .field-checkbox input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--lobster-red);
      cursor: pointer;
    }

    .field-checkbox label {
      font-size: 14px;
      cursor: pointer;
    }

    /* ── Run Button ───────────────────────── */

    .run-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 20px;
    }

    .run-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 28px;
      border-radius: var(--radius-pill);
      border: none;
      background: var(--lobster-red);
      color: white;
      font-family: "DM Sans", sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      box-shadow: var(--shadow);
    }

    .run-btn:hover { background: var(--lobster-red-hover); transform: translateY(-1px); box-shadow: var(--shadow-md); }
    .run-btn:active { transform: translateY(0); }
    .run-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

    .run-btn .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: none;
    }

    .run-btn.loading .spinner { display: block; }
    .run-btn.loading .play-icon { display: none; }

    @keyframes spin { to { transform: rotate(360deg); } }

    .timing {
      font-size: 13px;
      font-weight: 500;
      color: var(--green);
      opacity: 0;
      transition: opacity 0.3s;
    }

    .timing.visible { opacity: 1; }

    /* ── Output Panel ────────────────────── */

    .output-card {
      display: none;
    }

    .output-card.visible {
      display: block;
    }

    .output-pre {
      background: #1e1e2e;
      color: #cdd6f4;
      border-radius: var(--radius-sm);
      padding: 20px;
      overflow-x: auto;
      font-family: "JetBrains Mono", monospace;
      font-size: 13px;
      line-height: 1.7;
      max-height: 500px;
      overflow-y: auto;
    }

    /* JSON syntax highlighting */
    .json-key { color: #e8503a; }
    .json-string { color: #a6e3a1; }
    .json-number { color: #fab387; }
    .json-boolean { color: #89b4fa; }
    .json-null { color: #6c7086; }
    .json-bracket { color: #cdd6f4; }

    .output-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: var(--radius-sm);
      padding: 16px 20px;
      color: #991b1b;
      font-size: 14px;
    }

    .output-error .error-code {
      font-family: "JetBrains Mono", monospace;
      font-weight: 600;
      margin-bottom: 4px;
    }

    /* ── Loading State ───────────────────── */

    .loading-state {
      text-align: center;
      padding: 48px 24px;
    }

    .loading-state .loader {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--lobster-red);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }

    .loading-state p {
      color: var(--text-secondary);
      font-size: 14px;
    }

    .error-state {
      text-align: center;
      padding: 48px 24px;
    }

    .error-state p {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 16px;
    }

    .retry-btn {
      padding: 8px 24px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border);
      background: var(--bg-card);
      font-family: "DM Sans", sans-serif;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .retry-btn:hover { border-color: var(--lobster-red); color: var(--lobster-red); }

    /* ── Footer ──────────────────────────── */

    .footer {
      text-align: center;
      padding: 24px 0;
      color: var(--text-dim);
      font-size: 13px;
    }

    .footer a {
      color: var(--lobster-red);
      text-decoration: none;
      font-weight: 600;
    }

    .footer a:hover { text-decoration: underline; }

    /* ── Empty State ─────────────────────── */

    .empty-tools {
      text-align: center;
      padding: 32px;
      color: var(--text-secondary);
    }

    .empty-tools code {
      background: var(--bg);
      padding: 2px 8px;
      border-radius: 6px;
      font-family: "JetBrains Mono", monospace;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1><span class="lobster">&#129438;</span> ${name} Playground</h1>
        <p>${description}</p>
      </div>
      <div class="status" id="status">
        <span class="status-dot" id="statusDot"></span>
        <span class="status-text" id="statusText">Connecting...</span>
      </div>
    </div>

    <!-- Main Content -->
    <div id="mainContent">
      <div class="loading-state" id="loadingState">
        <div class="loader"></div>
        <p>Discovering tools...</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      Built with <a href="https://github.com/AndrewLeonardi/pinch-cli" target="_blank">pinch</a>
    </div>
  </div>

  <script>
    // ── State ──────────────────────────────────────────
    let tools = [];
    let selectedTool = null;
    let requestId = 1;
    let isConnected = false;
    let sessionId = null;

    const MCP_ENDPOINT = "/mcp";

    // ── MCP Client ────────────────────────────────────

    async function mcpCall(method, params) {
      const id = requestId++;
      const hdrs = { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" };
      if (sessionId) hdrs["Mcp-Session-Id"] = sessionId;

      const res = await fetch(MCP_ENDPOINT, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params: params || {} }),
      });

      // Capture session ID from response
      const sid = res.headers.get("Mcp-Session-Id");
      if (sid) sessionId = sid;

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("text/event-stream")) {
        // Parse SSE response — extract JSON-RPC message from data: lines
        const body = await res.text();
        const lines = body.split("\\n");
        for (const line of lines) {
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const json = JSON.parse(data);
              if (json.id === id) {
                if (json.error) throw json.error;
                return json.result;
              }
            } catch (e) {
              if (e && e.code) throw e; // re-throw JSON-RPC errors
            }
          }
        }
        throw new Error("No matching response found in SSE stream");
      } else {
        // Plain JSON response
        const json = await res.json();
        if (json.error) throw json.error;
        return json.result;
      }
    }

    // Send a JSON-RPC notification (no id, no response expected)
    async function mcpNotify(method, params) {
      const hdrs = { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" };
      if (sessionId) hdrs["Mcp-Session-Id"] = sessionId;

      const res = await fetch(MCP_ENDPOINT, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ jsonrpc: "2.0", method, params: params || {} }),
      });
      // Capture session ID if returned
      const sid = res.headers.get("Mcp-Session-Id");
      if (sid) sessionId = sid;
    }

    // MCP protocol requires initialize handshake before any other calls
    async function mcpHandshake() {
      sessionId = null; // reset for fresh handshake
      await mcpCall("initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "pinch-playground", version: "1.0.0" },
      });
      await mcpNotify("notifications/initialized");
    }

    // ── Connection ────────────────────────────────────

    async function checkConnection() {
      try {
        if (!sessionId) await mcpHandshake();
        const result = await mcpCall("tools/list");
        setConnected(true);
        return result.tools || [];
      } catch {
        setConnected(false);
        sessionId = null;
        return null;
      }
    }

    function setConnected(connected) {
      isConnected = connected;
      const dot = document.getElementById("statusDot");
      const text = document.getElementById("statusText");
      dot.className = "status-dot" + (connected ? " connected" : "");
      text.textContent = connected ? "Connected" : "Disconnected";
    }

    // Poll connection every 10s (only retry if disconnected)
    setInterval(async () => {
      if (!isConnected) {
        const result = await checkConnection();
        if (result && tools.length === 0) {
          tools = result;
          renderApp();
        }
      }
    }, 10000);

    // ── Rendering ─────────────────────────────────────

    function toTitleCase(str) {
      return str.replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase());
    }

    function renderApp() {
      const main = document.getElementById("mainContent");

      if (tools.length === 0) {
        main.innerHTML = '<div class="empty-tools"><p>No tools found. Define tools in <code>src/index.ts</code> and restart the server.</p></div>';
        return;
      }

      if (!selectedTool) selectedTool = tools[0];

      let html = '<div class="tool-tabs" id="toolTabs">';
      for (const tool of tools) {
        const active = tool.name === selectedTool.name ? " active" : "";
        html += '<button class="tool-tab' + active + '" data-tool="' + tool.name + '">' + tool.name + '</button>';
      }
      html += '</div>';

      // Input card
      html += '<div class="card">';
      html += '<div class="card-header"><span class="card-title">Input</span></div>';
      html += '<div class="tool-name">' + selectedTool.name + '</div>';
      html += '<div class="tool-desc">' + (selectedTool.description || "No description") + '</div>';

      const props = selectedTool.inputSchema?.properties || {};
      const required = selectedTool.inputSchema?.required || [];

      html += '<div id="formFields">';
      for (const [key, schema] of Object.entries(props)) {
        const isRequired = required.includes(key);
        const label = toTitleCase(key);
        const desc = schema.description || "";
        const type = schema.type || "string";

        html += '<div class="field">';

        if (type === "boolean") {
          const checked = schema.default === true ? " checked" : "";
          html += '<div class="field-checkbox">';
          html += '<input type="checkbox" id="field_' + key + '" data-key="' + key + '" data-type="boolean"' + checked + '>';
          html += '<label for="field_' + key + '">' + label;
          if (isRequired) html += '<span class="required">*</span>';
          html += '</label>';
          html += '</div>';
        } else {
          html += '<label class="field-label" for="field_' + key + '">' + label;
          if (isRequired) html += '<span class="required">*</span>';
          html += '<span class="type-badge">' + type + '</span>';
          html += '</label>';

          if (schema.enum) {
            html += '<select id="field_' + key + '" data-key="' + key + '" data-type="enum">';
            for (const opt of schema.enum) {
              const sel = schema.default === opt ? " selected" : "";
              html += '<option value="' + opt + '"' + sel + '>' + opt + '</option>';
            }
            html += '</select>';
          } else if (type === "array" || type === "object") {
            const placeholder = type === "array" ? "JSON array, e.g. [{\\"key\\": \\"value\\"}]" : "JSON object, e.g. {\\"key\\": \\"value\\"}";
            const defaultVal = schema.default != null ? JSON.stringify(schema.default, null, 2) : "";
            html += '<textarea id="field_' + key + '" data-key="' + key + '" data-type="' + type + '" placeholder="' + placeholder + '">' + defaultVal + '</textarea>';
          } else if (type === "number" || type === "integer") {
            const defaultVal = schema.default != null ? schema.default : "";
            html += '<input type="number" id="field_' + key + '" data-key="' + key + '" data-type="number" value="' + defaultVal + '" placeholder="Enter a number">';
          } else {
            // string
            const isLong = desc.toLowerCase().match(/long|body|content|message|text|description|notes/);
            const defaultVal = schema.default != null ? schema.default : "";
            if (isLong) {
              html += '<textarea id="field_' + key + '" data-key="' + key + '" data-type="string" placeholder="' + (desc || "Enter text") + '">' + defaultVal + '</textarea>';
            } else {
              html += '<input type="text" id="field_' + key + '" data-key="' + key + '" data-type="string" value="' + defaultVal + '" placeholder="' + (desc || "Enter value") + '">';
            }
          }
        }

        if (desc && type !== "boolean") {
          html += '<div class="field-hint">' + desc + '</div>';
        }

        html += '</div>';
      }
      html += '</div>';

      // Run button
      html += '<div class="run-row">';
      html += '<button class="run-btn" id="runBtn" onclick="runTool()">';
      html += '<span class="play-icon">&#9654;</span>';
      html += '<span class="spinner"></span>';
      html += ' Run Tool</button>';
      html += '<span class="timing" id="timing"></span>';
      html += '</div>';

      html += '</div>';

      // Output card
      html += '<div class="card output-card" id="outputCard">';
      html += '<div class="card-header"><span class="card-title">Output</span></div>';
      html += '<div id="outputContent"></div>';
      html += '</div>';

      main.innerHTML = html;

      // Bind tab clicks
      document.querySelectorAll(".tool-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          const name = tab.dataset.tool;
          selectedTool = tools.find(t => t.name === name);
          renderApp();
        });
      });
    }

    // ── Run Tool ──────────────────────────────────────

    async function runTool() {
      const btn = document.getElementById("runBtn");
      const timingEl = document.getElementById("timing");
      const outputCard = document.getElementById("outputCard");
      const outputContent = document.getElementById("outputContent");

      // Collect form values
      const args = {};
      document.querySelectorAll("[data-key]").forEach(el => {
        const key = el.dataset.key;
        const type = el.dataset.type;
        let value;

        if (type === "boolean") {
          value = el.checked;
        } else if (type === "number") {
          if (el.value === "") return;
          value = Number(el.value);
        } else if (type === "array" || type === "object") {
          if (!el.value.trim()) return;
          try {
            value = JSON.parse(el.value);
          } catch {
            value = el.value;
          }
        } else if (type === "enum") {
          value = el.value;
        } else {
          if (!el.value.trim()) return;
          value = el.value;
        }

        args[key] = value;
      });

      // UI loading state
      btn.classList.add("loading");
      btn.disabled = true;
      timingEl.classList.remove("visible");

      try {
        const t0 = performance.now();
        const result = await mcpCall("tools/call", { name: selectedTool.name, arguments: args });
        const elapsed = Math.round(performance.now() - t0);

        // Show timing
        timingEl.textContent = "\\u2713 " + elapsed + "ms";
        timingEl.classList.add("visible");

        // Render output
        const content = result.content || [];
        const textParts = content.filter(c => c.type === "text" && c.text).map(c => c.text);
        const text = textParts.join("\\n");

        outputCard.classList.add("visible");

        if (text) {
          try {
            const parsed = JSON.parse(text);
            outputContent.innerHTML = '<pre class="output-pre">' + syntaxHighlight(parsed) + '</pre>';
          } catch {
            outputContent.innerHTML = '<pre class="output-pre">' + escapeHtml(text) + '</pre>';
          }
        } else {
          outputContent.innerHTML = '<pre class="output-pre">' + escapeHtml(JSON.stringify(result, null, 2)) + '</pre>';
        }
      } catch (err) {
        outputCard.classList.add("visible");
        let errHtml = '<div class="output-error">';
        if (err.code) errHtml += '<div class="error-code">Error ' + err.code + '</div>';
        errHtml += '<div>' + escapeHtml(err.message || String(err)) + '</div>';
        errHtml += '</div>';
        outputContent.innerHTML = errHtml;
        timingEl.classList.remove("visible");
      } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
      }
    }

    // ── JSON Syntax Highlighting ──────────────────────

    function syntaxHighlight(obj) {
      const json = JSON.stringify(obj, null, 2);
      return json.replace(
        /("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g,
        function (match) {
          let cls = "json-number";
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = "json-key";
              // Remove trailing colon for wrapping, add back after
              return '<span class="' + cls + '">' + escapeHtml(match.slice(0, -1)) + '</span>:';
            } else {
              cls = "json-string";
            }
          } else if (/true|false/.test(match)) {
            cls = "json-boolean";
          } else if (/null/.test(match)) {
            cls = "json-null";
          }
          return '<span class="' + cls + '">' + escapeHtml(match) + '</span>';
        }
      );
    }

    function escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // ── Init ──────────────────────────────────────────

    async function init() {
      const discovered = await checkConnection();
      if (discovered) {
        tools = discovered;
        renderApp();
      } else {
        document.getElementById("mainContent").innerHTML =
          '<div class="error-state">' +
          '<p>Could not connect to the MCP server. Make sure it\\u2019s running.</p>' +
          '<button class="retry-btn" onclick="init()">Retry</button>' +
          '</div>';
      }
    }

    init();
  </script>
</body>
</html>`;
}
