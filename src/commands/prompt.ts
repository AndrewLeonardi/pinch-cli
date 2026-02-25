import chalk from "chalk";
import { input as promptInput } from "@inquirer/prompts";

const PROMPT_TEMPLATE = `You are building an MCP (Model Context Protocol) tool package for the Pinch CLI framework.

Output a single JSON object with this exact structure:

{
  "name": "Tool Name",
  "slug": "tool-name",
  "description": "What this tool does in one sentence",
  "category": "one of: productivity, development, finance, data, writing, design, marketing, education, entertainment, other",
  "version": "0.1.0",
  "tags": ["tag1", "tag2"],
  "source_code": "... (TypeScript source code for src/tools.ts) ...",
  "ui_files": {
    "index.html": "... (optional HTML frontend) ...",
    "styles.css": "... (optional CSS) ..."
  },
  "schema_sql": "... (optional D1 database schema) ...",
  "server_files": {
    "helpers/utils.ts": "... (optional additional server modules) ..."
  }
}

## source_code Requirements

The source_code field must be a valid TypeScript file that:

1. Imports McpServer and zod:
   import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
   import { z } from "zod";

2. Exports a registerTools function:
   export function registerTools(server: McpServer, storage: any) {
     server.tool("tool_name", "description", { param: z.string() }, async ({ param }) => {
       return { content: [{ type: "text", text: "result" }] };
     });
   }

3. Uses Zod for input validation (z.string(), z.number(), z.boolean(), z.array(), z.object(), etc.)

4. Returns results in MCP format: { content: [{ type: "text", text: "..." }] }

5. Can use the storage parameter for persistence:
   - await storage.get("key") — returns string or null
   - await storage.set("key", "value")
   - await storage.delete("key")
   - await storage.keys() — returns string[]

## ui_files (Optional)

If the tool has a frontend, include an index.html that uses the bridge API:

- window.pinch.callTool("tool_name", { args }) — calls an MCP tool, returns { content: [...] }
- window.pinch.listTools() — discovers available tools
- window.pinch.ready — promise that resolves when the bridge is connected

The bridge script is auto-injected. Do NOT include any MCP connection logic in the HTML.

## schema_sql (Optional)

If the tool needs a database, include CREATE TABLE statements for Cloudflare D1 (SQLite syntax).
Access the database in tools via env.DB.prepare("SELECT ...").bind(...).all()

## Important Rules

- Output ONLY the JSON object, no markdown, no explanation
- All string values must be properly escaped for JSON
- The source_code must be complete and working
- Use descriptive tool names and descriptions (AI agents use these to decide which tool to call)
- Add proper Zod .describe() annotations on all parameters

## Tool Description

Build the following tool:
TOOL_DESCRIPTION_HERE`;

export async function promptCommand(descriptionArg?: string) {
  let description: string;

  if (descriptionArg) {
    description = descriptionArg;
  } else {
    console.log(
      chalk.bold("\n  pinch prompt") +
        chalk.dim(" — generate an AI prompt for building a tool\n")
    );

    description = await promptInput({
      message: "Describe the tool you want to build:",
    });
  }

  if (!description.trim()) {
    console.log(chalk.red("  Please provide a description.\n"));
    process.exit(1);
  }

  const prompt = PROMPT_TEMPLATE.replace("TOOL_DESCRIPTION_HERE", description.trim());

  // Try to copy to clipboard
  let copied = false;
  try {
    const { execSync } = await import("child_process");
    const platform = process.platform;
    if (platform === "darwin") {
      execSync("pbcopy", { input: prompt });
      copied = true;
    } else if (platform === "linux") {
      execSync("xclip -selection clipboard", { input: prompt });
      copied = true;
    } else if (platform === "win32") {
      execSync("clip", { input: prompt });
      copied = true;
    }
  } catch {
    // Clipboard not available — that's fine
  }

  if (copied) {
    console.log(chalk.green("\n  Prompt copied to clipboard!\n"));
    console.log(chalk.dim("  Next steps:"));
    console.log(chalk.dim("    1. Paste into Claude, ChatGPT, or any AI"));
    console.log(chalk.dim("    2. Save the JSON output to a file (e.g., package.json)"));
    console.log(chalk.dim("    3. Run: pinch import package.json\n"));
  } else {
    // Print to stdout if clipboard isn't available
    console.log(chalk.dim("\n  --- Copy the prompt below ---\n"));
    console.log(prompt);
    console.log(chalk.dim("\n  --- End of prompt ---\n"));
    console.log(chalk.dim("  Paste into Claude, ChatGPT, or any AI."));
    console.log(chalk.dim("  Save the JSON output, then run: pinch import <file>\n"));
  }
}
