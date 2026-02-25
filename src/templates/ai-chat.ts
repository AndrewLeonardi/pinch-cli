import { getPlaygroundHtml } from "./playground.js";
import { generateToolsFile, generateDevServer, getPackageJson, getTsConfig, getGitignore, getEnvExample, getReadme } from "./server-runtime.js";
import { generateWranglerConfig } from "../lib/worker-gen.js";

export function aiChatTemplate(
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
tags = ["ai", "chat", "llm"]

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "free"

[[test]]
tool = "chat"
input = { message = "Hello" }
expect_type = "json"
expect_contains = "response"
`;

  const toolsCode = generateToolsFile({
    state: `// Chat history per session — in production you'd use storage for persistence
const chatSessions = new Map<string, Array<{ role: string; content: string }>>();

// Simple response generator — replace with a real LLM API call
// Examples: OpenAI, Anthropic, Google AI, or any OpenAI-compatible endpoint
function generateResponse(messages: Array<{ role: string; content: string }>): string {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

  // Simple pattern matching — swap this with your LLM API
  if (lastMessage.includes("hello") || lastMessage.includes("hi")) {
    return "Hello! I'm your AI assistant. How can I help you today?";
  }
  if (lastMessage.includes("help")) {
    return "I can help you with:\\n- Answering questions\\n- Writing and editing text\\n- Brainstorming ideas\\n- Code explanations\\n\\nJust ask me anything!";
  }
  if (lastMessage.includes("joke")) {
    const jokes = [
      "Why do programmers prefer dark mode? Because light attracts bugs!",
      "There are only 10 types of people: those who understand binary and those who don't.",
      "A SQL query walks into a bar, sees two tables, and asks... 'Can I JOIN you?'",
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }
  return "I received your message: \\"" + messages[messages.length - 1]?.content +
    "\\". To make this a real AI chat, replace the generateResponse function in src/tools.ts with an API call to OpenAI, Anthropic, or any LLM provider.";
}`,

    tools: `  server.tool(
    "chat",
    "Send a message and get an AI response. Maintains conversation history per session.",
    {
      message: z.string().describe("The user's message"),
      session_id: z.string().default("default").describe("Session ID for conversation continuity"),
    },
    async ({ message, session_id }) => {
      // Get or create session history
      if (!chatSessions.has(session_id)) {
        chatSessions.set(session_id, []);
      }
      const history = chatSessions.get(session_id)!;

      // Add user message
      history.push({ role: "user", content: message });

      // Generate response (replace with real LLM call)
      const response = generateResponse(history);

      // Add assistant response to history
      history.push({ role: "assistant", content: response });

      // Keep history manageable (last 20 messages)
      if (history.length > 20) {
        chatSessions.set(session_id, history.slice(-20));
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            response,
            session_id,
            message_count: history.length,
          }),
        }],
      };
    }
  );

  server.tool(
    "clear_chat",
    "Clear conversation history for a session",
    {
      session_id: z.string().default("default").describe("Session ID to clear"),
    },
    async ({ session_id }) => {
      chatSessions.delete(session_id);
      return {
        content: [{ type: "text", text: JSON.stringify({ cleared: true, session_id }) }],
      };
    }
  );`,
  });

  const uiHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="chat-app">
    <header>
      <h1>AI Chat</h1>
      <button class="clear-btn" onclick="clearChat()">Clear</button>
    </header>

    <div id="messages" class="messages">
      <div class="message assistant">
        <div class="bubble">Hello! I'm your AI assistant. How can I help you today?</div>
      </div>
    </div>

    <form class="input-area" onsubmit="sendMessage(event)">
      <input type="text" id="messageInput" placeholder="Type a message..." autocomplete="off">
      <button type="submit" id="sendBtn">Send</button>
    </form>
  </div>

  <script>
    const sessionId = 'session-' + Math.random().toString(36).slice(2, 9);

    async function sendMessage(e) {
      e.preventDefault();
      const input = document.getElementById('messageInput');
      const msg = input.value.trim();
      if (!msg) return;

      // Add user message to UI
      addMessage('user', msg);
      input.value = '';

      // Show typing indicator
      const typing = addMessage('assistant', '...');
      typing.classList.add('typing');

      try {
        const result = await window.pinch.callTool('chat', {
          message: msg,
          session_id: sessionId,
        });
        const data = JSON.parse(result.content[0].text);

        // Replace typing indicator with response
        typing.querySelector('.bubble').textContent = data.response;
        typing.classList.remove('typing');
      } catch (err) {
        typing.querySelector('.bubble').textContent = 'Error: ' + err.message;
        typing.classList.remove('typing');
        typing.classList.add('error');
      }

      scrollToBottom();
    }

    function addMessage(role, text) {
      const messages = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.innerHTML = '<div class="bubble">' + escapeHtml(text) + '</div>';
      messages.appendChild(div);
      scrollToBottom();
      return div;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function scrollToBottom() {
      const messages = document.getElementById('messages');
      messages.scrollTop = messages.scrollHeight;
    }

    async function clearChat() {
      try {
        await window.pinch.callTool('clear_chat', { session_id: sessionId });
        const messages = document.getElementById('messages');
        messages.innerHTML = '<div class="message assistant"><div class="bubble">Chat cleared. How can I help you?</div></div>';
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }

    // Focus input on load
    document.getElementById('messageInput').focus();
  </script>
</body>
</html>`;

  const uiCss = `* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #f0ece4;
  color: #1a1a1a;
  height: 100vh;
  overflow: hidden;
}

.chat-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 700px;
  margin: 0 auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #d9d3c7;
  background: #fff;
}

header h1 { font-size: 1.2rem; }

.clear-btn {
  padding: 0.4rem 0.8rem;
  background: transparent;
  color: #888;
  border: 1px solid #d9d3c7;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.clear-btn:hover { background: #f8f6f2; }

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  display: flex;
  max-width: 80%;
}

.message.user {
  align-self: flex-end;
}

.message.assistant {
  align-self: flex-start;
}

.bubble {
  padding: 0.75rem 1rem;
  border-radius: 16px;
  line-height: 1.5;
  font-size: 0.95rem;
  white-space: pre-wrap;
}

.user .bubble {
  background: #e8503a;
  color: white;
  border-bottom-right-radius: 4px;
}

.assistant .bubble {
  background: #fff;
  border: 1px solid #d9d3c7;
  border-bottom-left-radius: 4px;
}

.typing .bubble {
  color: #888;
  animation: pulse 1s infinite;
}

.error .bubble {
  background: #fef2f2;
  border-color: #e8503a;
  color: #e8503a;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.input-area {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #d9d3c7;
  background: #fff;
}

.input-area input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d9d3c7;
  border-radius: 24px;
  font-size: 1rem;
  outline: none;
  background: #f8f6f2;
}

.input-area input:focus {
  border-color: #e8503a;
  background: #fff;
}

.input-area button {
  padding: 0.75rem 1.5rem;
  background: #e8503a;
  color: white;
  border: none;
  border-radius: 24px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.input-area button:hover { background: #d14430; }`;

  return {
    "pinch.toml": manifest,
    "src/tools.ts": toolsCode,
    "src/index.ts": generateDevServer(name),
    "wrangler.toml": generateWranglerConfig(slug, name),
    "ui/index.html": uiHtml,
    "ui/styles.css": uiCss,
    "public/playground.html": getPlaygroundHtml(name, description),
    "package.json": getPackageJson(slug, description),
    "tsconfig.json": getTsConfig(),
    ".gitignore": getGitignore(),
    ".env.example": getEnvExample(),
    "README.md": getReadme(name, slug, description),
  };
}
