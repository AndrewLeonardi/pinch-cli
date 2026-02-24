#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { testCommand } from "./commands/test.js";
import { loginCommand } from "./commands/login.js";
import { publishCommand } from "./commands/publish.js";
import { deployCommand } from "./commands/deploy.js";

const program = new Command();

program
  .name("pinch")
  .description(
    chalk.bold("⚡ pinch") +
      chalk.dim(" — the fastest way to build MCP servers\n\n") +
      "  Build, test, and deploy MCP (Model Context Protocol) servers.\n" +
      "  Your AI tools, deployed anywhere.\n\n" +
      chalk.dim("  Docs: https://github.com/AndrewLeonardi/pinch-cli")
  )
  .version("0.2.0");

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

// ── Deploy commands ───────────────────────────────────────

program
  .command("deploy")
  .description("Deploy your MCP server (Cloudflare, Docker, or Pinchers.ai)")
  .argument("[target]", "deployment target: cloudflare, docker, or pinchers")
  .option("--setup", "configure credentials for the target")
  .action(deployCommand);

// ── Pinchers.ai specific ─────────────────────────────────

program
  .command("login")
  .description("Authenticate with Pinchers.ai marketplace")
  .action(loginCommand);

program
  .command("publish")
  .description("Submit to Pinchers.ai (alias for deploy pinchers)")
  .action(publishCommand);

program.parse();
