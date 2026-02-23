import { resolve } from "path";
import { spawn, exec, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { platform } from "os";
import chalk from "chalk";
import { loadManifest } from "../lib/config.js";
import { createInterface } from "readline";

// ── Open browser helper ──────────────────────────────

function openBrowser(url: string) {
  const cmd =
    platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  exec(`${cmd} ${url}`);
}

// ── Pretty JSON formatter ──────────────────────────────

function prettyJson(obj: unknown): string {
  const raw = JSON.stringify(obj, null, 2);
  return raw
    .split("\n")
    .map(
      (line) =>
        "    " +
        line
          .replace(/"([^"]+)":/g, (_, key: string) => chalk.cyan(`"${key}"`) + ":")
          .replace(/: "([^"]*)"(,?)$/g, (_, val: string, comma: string) => `: ${chalk.green(`"${val}"`)}${comma}`)
          .replace(/: (\d+\.?\d*)(,?)$/g, (_, num: string, comma: string) => `: ${chalk.yellow(num)}${comma}`)
          .replace(/: (true|false)(,?)$/g, (_, bool: string, comma: string) => `: ${chalk.yellow(bool)}${comma}`)
          .replace(/: (null)(,?)$/g, (_: string, __: string, comma: string) => `: ${chalk.dim("null")}${comma}`)
    )
    .join("\n");
}

// ── REPL ───────────────────────────────────────────────

function startRepl(endpoint: string, initialVerbose: boolean) {
  let verboseMode = initialVerbose;

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log(chalk.bold("  Commands:\n"));
  console.log(chalk.dim("    list") + "              List available tools");
  console.log(chalk.dim("    info <tool>") + "       Show tool schema and parameters");
  console.log(chalk.dim("    <tool> k=v ...") + "    Call a tool with arguments");
  console.log(chalk.dim("    verbose") + "           Toggle verbose request/response");
  console.log(chalk.dim("    help") + "              Show commands");
  console.log(chalk.dim("    quit") + "              Stop and exit\n");

  const prompt = () =>
    rl.question(chalk.red("🦞 ") + chalk.dim("pinch> "), async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return prompt();

      // ── quit ─────────────────────────
      if (trimmed === "quit" || trimmed === "exit") {
        rl.close();
        process.exit(0);
      }

      // ── help ─────────────────────────
      if (trimmed === "help") {
        console.log(chalk.bold("\n  REPL Commands:\n"));
        console.log(`  ${chalk.cyan("list")}              List available tools`);
        console.log(`  ${chalk.cyan("info <tool>")}       Show tool schema and parameters`);
        console.log(`  ${chalk.cyan("<tool> k=v ...")}    Call a tool with arguments`);
        console.log(`  ${chalk.cyan("verbose")}           Toggle verbose request/response logging`);
        console.log(`  ${chalk.cyan("help")}              Show this help message`);
        console.log(`  ${chalk.cyan("quit")}              Stop the server and exit\n`);
        return prompt();
      }

      // ── verbose toggle ───────────────
      if (trimmed === "verbose") {
        verboseMode = !verboseMode;
        console.log(
          chalk.dim("  Verbose mode: ") +
            (verboseMode ? chalk.green("on") : chalk.yellow("off")) +
            "\n"
        );
        return prompt();
      }

      // ── list ─────────────────────────
      if (trimmed === "list") {
        try {
          const body = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
          if (verboseMode) {
            console.log(chalk.dim("\n  → POST ") + chalk.cyan(endpoint));
            console.log(prettyJson(body));
          }
          const t0 = performance.now();
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await res.json()) as {
            result?: { tools?: Array<{ name: string; description?: string }> };
          };
          const elapsed = (performance.now() - t0).toFixed(0);

          if (verboseMode) {
            console.log(chalk.dim("  ← ") + chalk.green(String(res.status)));
            console.log(prettyJson(json));
          }

          const tools = json.result?.tools || [];
          if (tools.length === 0) {
            console.log(chalk.yellow("  No tools found."));
          } else {
            console.log(chalk.bold("\n  Available tools:\n"));
            for (const t of tools) {
              console.log(
                `  ${chalk.cyan(t.name)} — ${chalk.dim(t.description || "")}`
              );
            }
          }
          console.log(chalk.dim(`  ${chalk.green("✓")} ${elapsed}ms\n`));
        } catch (err: unknown) {
          printConnectionError(err, endpoint);
        }
        return prompt();
      }

      // ── info <tool> ──────────────────
      if (trimmed.startsWith("info ")) {
        const toolName = trimmed.slice(5).trim();
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "tools/list",
              params: {},
            }),
          });
          const json = (await res.json()) as {
            result?: {
              tools?: Array<{
                name: string;
                description?: string;
                inputSchema?: {
                  properties?: Record<string, { type?: string; description?: string; enum?: string[] }>;
                  required?: string[];
                };
              }>;
            };
          };
          const tools = json.result?.tools || [];
          const tool = tools.find((t) => t.name === toolName);

          if (!tool) {
            console.log(chalk.red(`\n  Tool "${toolName}" not found.`));
            if (tools.length > 0) {
              console.log(
                chalk.dim("  Available: ") + tools.map((t) => t.name).join(", ")
              );
            }
            console.log();
          } else {
            console.log(chalk.bold(`\n  ${tool.name}`));
            console.log(chalk.dim(`  ${tool.description || "No description"}\n`));
            if (tool.inputSchema?.properties) {
              console.log(chalk.bold("  Parameters:\n"));
              const required = tool.inputSchema.required || [];
              for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
                const isRequired = required.includes(key);
                const typeStr = schema.type || "any";
                const desc = schema.description || "";
                const enumStr = schema.enum ? ` [${schema.enum.join("|")}]` : "";
                console.log(
                  `    ${chalk.cyan(key)}${isRequired ? "" : chalk.dim("?")} ` +
                    `${chalk.dim(typeStr)}${chalk.dim(enumStr)} — ${desc}`
                );
              }
              console.log();
              console.log(
                chalk.dim("  Example: ") +
                  chalk.cyan(
                    `${tool.name} ${Object.keys(tool.inputSchema.properties)
                      .slice(0, 2)
                      .map((k) => `${k}=value`)
                      .join(" ")}`
                  ) +
                  "\n"
              );
            }
          }
        } catch (err: unknown) {
          printConnectionError(err, endpoint);
        }
        return prompt();
      }

      // ── tool call ────────────────────
      const parts = trimmed.split(/\s+/);
      const toolName = parts[0];
      const args: Record<string, string> = {};
      for (let i = 1; i < parts.length; i++) {
        const eq = parts[i].indexOf("=");
        if (eq > 0) {
          args[parts[i].slice(0, eq)] = parts[i].slice(eq + 1);
        }
      }

      // Auto-parse JSON values in args
      const parsedArgs: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        try {
          if (
            (v.startsWith("[") && v.endsWith("]")) ||
            (v.startsWith("{") && v.endsWith("}"))
          ) {
            parsedArgs[k] = JSON.parse(v);
          } else if (v === "true" || v === "false") {
            parsedArgs[k] = v === "true";
          } else if (!isNaN(Number(v)) && v !== "") {
            parsedArgs[k] = Number(v);
          } else {
            parsedArgs[k] = v;
          }
        } catch {
          parsedArgs[k] = v;
        }
      }

      try {
        const body = {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: toolName, arguments: parsedArgs },
        };

        if (verboseMode) {
          console.log(chalk.dim("\n  → POST ") + chalk.cyan(endpoint));
          console.log(prettyJson(body));
        }

        const t0 = performance.now();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          result?: { content?: Array<{ type: string; text?: string }> };
          error?: { code?: number; message: string; data?: unknown };
        };
        const elapsed = (performance.now() - t0).toFixed(0);

        if (verboseMode) {
          console.log(chalk.dim("  ← ") + chalk.green(String(res.status)));
          console.log(prettyJson(json));
        }

        if (json.error) {
          console.log(
            chalk.red(`\n  Error${json.error.code ? ` ${json.error.code}` : ""}: ${json.error.message}`)
          );
          if (json.error.data) {
            console.log(chalk.dim("  Data: ") + JSON.stringify(json.error.data));
          }
          console.log();
        } else {
          const content = json.result?.content || [];
          for (const c of content) {
            if (c.type === "text" && c.text) {
              // Try to pretty-print as JSON
              try {
                const parsed = JSON.parse(c.text);
                console.log("\n" + prettyJson(parsed));
              } catch {
                console.log(chalk.green("\n  " + c.text));
              }
            } else {
              console.log(chalk.dim(`\n  [${c.type}] `) + JSON.stringify(c));
            }
          }
          console.log(chalk.dim(`  ${chalk.green("✓")} ${elapsed}ms\n`));
        }
      } catch (err: unknown) {
        printConnectionError(err, endpoint);
      }

      prompt();
    });

  prompt();
}

// ── Error helper ───────────────────────────────────────

function printConnectionError(err: unknown, endpoint: string) {
  if (err instanceof TypeError && String(err.cause || "").includes("ECONNREFUSED")) {
    console.log(
      chalk.red("  Connection refused.") +
        chalk.dim(` Server not reachable at ${endpoint}\n`)
    );
  } else {
    console.log(chalk.red("  Request failed: ") + chalk.dim(String(err)) + "\n");
  }
}

// ── Main command ───────────────────────────────────────

export async function devCommand(options: {
  port: string;
  verbose?: boolean;
  endpoint?: string;
  browser?: boolean;
}) {
  // Endpoint-only mode: connect to external MCP server
  if (options.endpoint) {
    console.log(
      chalk.red("🦞") +
        chalk.bold(" pinch dev") +
        chalk.dim(" — connected to external server")
    );
    console.log(chalk.dim(`  Endpoint: ${options.endpoint}\n`));
    startRepl(options.endpoint, options.verbose || false);
    return;
  }

  // Project mode: load manifest and start local server
  const manifest = await loadManifest();
  if (!manifest) {
    console.log(
      chalk.red("\n  No pinchers.toml found. Run `pinch init` first.")
    );
    console.log(
      chalk.dim("  Or use ") +
        chalk.cyan("pinch dev --endpoint <url>") +
        chalk.dim(" to connect to an external server.\n")
    );
    process.exit(1);
  }

  const port = options.port;
  const entryFile = resolve(process.cwd(), "src/index.ts");

  if (!existsSync(entryFile)) {
    console.log(chalk.red("\n  No src/index.ts found.\n"));
    process.exit(1);
  }

  console.log(
    chalk.red("🦞") + chalk.bold(` pinch dev`) + ` — ${manifest.tool.name}`
  );
  console.log(chalk.dim(`  Starting on port ${port} with hot reload...\n`));

  let child: ChildProcess | null = null;
  let browserOpened = false;
  const shouldOpenBrowser = options.browser !== false;

  function startServer() {
    child = spawn("npx", ["tsx", "--watch", "src/index.ts"], {
      env: { ...process.env, PORT: port },
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString();
      process.stdout.write(chalk.dim("  [server] ") + msg);

      // Auto-open browser when server reports it's running
      if (!browserOpened && shouldOpenBrowser && msg.includes("running on")) {
        browserOpened = true;
        const playgroundUrl = `http://localhost:${port}`;
        console.log(
          chalk.bold("\n  🦞 Playground open at ") +
            chalk.cyan(playgroundUrl) +
            "\n"
        );
        openBrowser(playgroundUrl);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes("Restarting")) {
        console.log(chalk.yellow("  ↻ Reloading..."));
      } else {
        process.stderr.write(chalk.red("  [error] ") + msg);
      }
    });

    child.on("exit", (code) => {
      if (code && code !== 0) {
        console.log(chalk.red(`  Server exited with code ${code}`));
      }
    });
  }

  startServer();

  const endpoint = `http://localhost:${port}${manifest.tool.mcp.endpoint}`;

  // Handle cleanup
  const cleanup = () => {
    child?.kill();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  startRepl(endpoint, options.verbose || false);
}
