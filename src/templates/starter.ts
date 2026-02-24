import { getPlaygroundHtml } from "./playground.js";
import { generateToolsFile, generateDevServer, getPackageJson, getTsConfig, getGitignore, getEnvExample, getReadme } from "./server-runtime.js";
import { generateWranglerConfig } from "../lib/worker-gen.js";

export function starterTemplate(
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
type = "free"
`;

  const toolsCode = generateToolsFile({
    tools: `  // Define your tools here
  server.tool(
    "hello",
    "Say hello to someone. Use this when someone wants a friendly greeting.",
    { name: z.string().describe("Name of the person to greet") },
    async ({ name }) => ({
      content: [{ type: "text", text: \`Hello, \${name}! ⚡\` }],
    })
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
