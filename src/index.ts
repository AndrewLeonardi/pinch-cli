#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { createRequire } from "module";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { testCommand } from "./commands/test.js";
import { loginCommand } from "./commands/login.js";
import { deployCommand } from "./commands/deploy.js";
import { importCommand } from "./commands/import.js";
import { exportCommand } from "./commands/export.js";
import { promptCommand } from "./commands/prompt.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

program
  .name("pinch")
  .description(
    chalk.bold("pinch") +
      chalk.dim(" — build, test, and deploy MCP servers\n\n") +
      "  The fastest way to ship AI tools with custom frontends.\n" +
      "  Works standalone or with the Pinchers.ai marketplace.\n\n" +
      chalk.dim("  Docs:   https://github.com/AndrewLeonardi/pinch-cli\n") +
      chalk.dim("  Site:   https://pinchers.ai")
  )
  .version(version);

// ── Core commands ─────────────────────────────────────────

program
  .command("init")
  .description("Create a new MCP server project")
  .argument("[name]", "project name")
  .action(initCommand);

program
  .command("dev")
  .description("Start local dev server with hot reload + playground")
  .option("-p, --port <port>", "port to run on", "3100")
  .option("-v, --verbose", "show full request/response JSON")
  .option("-e, --endpoint <url>", "connect to an external MCP server (skip local server)")
  .option("--no-browser", "don't auto-open playground in browser")
  .action(devCommand);

program
  .command("test")
  .description("Validate manifest and run contract tests")
  .option("-p, --port <port>", "port for test server", "3199")
  .action(testCommand);

// ── AI-first workflow ────────────────────────────────────

program
  .command("prompt")
  .description("Generate an AI prompt for building a new tool")
  .argument("[description]", "what the tool should do")
  .action(promptCommand);

program
  .command("import")
  .description("Import a JSON tool package (from AI output) into a project")
  .argument("[file]", "path to JSON package file (or paste interactively)")
  .action(importCommand);

program
  .command("export")
  .description("Export current project as a portable JSON package")
  .option("-o, --output <file>", "write to file instead of stdout")
  .action(exportCommand);

// ── Deploy commands ───────────────────────────────────────

program
  .command("deploy")
  .description("Deploy your MCP server (Cloudflare, Docker, or Pinchers.ai)")
  .argument("[target]", "deployment target: cloudflare, docker, or pinchers")
  .option("--setup", "configure credentials for the target")
  .action(deployCommand);

// ── Pinchers.ai marketplace ──────────────────────────────

program
  .command("login")
  .description("Authenticate with Pinchers.ai marketplace")
  .action(loginCommand);

program.parse();
