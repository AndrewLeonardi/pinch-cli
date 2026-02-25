import { resolve } from "path";
import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import chalk from "chalk";
import { loadManifest, type TestCase } from "../lib/config.js";
import {
  createSession,
  initializeSession,
  mcpCall,
  buildMinimalInput,
  type McpSession,
  type ToolSchema,
} from "../lib/mcp-client.js";

// ── Result tracking ─────────────────────────────────────

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, hint?: string) {
  if (ok) {
    console.log(chalk.green("  ✓ ") + label);
    passed++;
  } else {
    console.log(chalk.red("  ✗ ") + label + (hint ? chalk.dim(` — ${hint}`) : ""));
    failed++;
  }
}

// ── Phase 1: Manifest validation ────────────────────────

function runManifestChecks(manifest: NonNullable<Awaited<ReturnType<typeof loadManifest>>>) {
  console.log(chalk.bold("\n  Phase 1: Manifest Validation\n"));

  const t = manifest.tool;
  check("tool.name is set", !!t.name, "Add name to [tool]");
  check("tool.slug is set", !!t.slug, "Add slug to [tool]");
  check("tool.slug is valid", /^[a-z0-9-]+$/.test(t.slug || ""), "Slug must be lowercase alphanumeric with hyphens");
  check("tool.description is set", !!t.description && t.description.length > 5, "Add a meaningful description");
  check("tool.version is set", !!t.version, "Add version to [tool]");
  check("tool.version is semver", /^\d+\.\d+\.\d+/.test(t.version || ""), "Use semver format (1.0.0)");
  check("tool.category is set", !!t.category, "Add category to [tool]");
  check("tool.mcp.endpoint is set", !!t.mcp?.endpoint, "Add endpoint to [tool.mcp]");
  check("tool.mcp.transport is set", !!t.mcp?.transport, "Add transport to [tool.mcp]");
  check("tool.mcp.transport is streamable-http", t.mcp?.transport === "streamable-http", "Only streamable-http is supported");

  if (t.tags) {
    check("tool.tags is an array", Array.isArray(t.tags));
  }
  if (t.pricing) {
    check("tool.pricing.type is valid", t.pricing.type === "free" || t.pricing.type === "credits", "Must be 'free' or 'credits'");
    if (t.pricing.type === "credits") {
      check("tool.pricing.credit_cost is set", typeof t.pricing.credit_cost === "number" && t.pricing.credit_cost > 0, "Set credit_cost for paid tools");
    }
  }
}

// ── Phase 2: Live contract tests ────────────────────────

async function waitForServer(baseUrl: string, timeoutMs: number = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl, { method: "GET" });
      if (res.ok || res.status < 500) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function runContractTests(session: McpSession): Promise<ToolSchema[]> {
  console.log(chalk.bold("\n  Phase 2: Contract Tests\n"));

  // Initialize MCP session first
  try {
    await initializeSession(session);
    check("MCP session initialized", true);
  } catch (err: unknown) {
    check("MCP session initialized", false, String(err));
    return [];
  }

  // Discover tools
  let tools: ToolSchema[] = [];
  try {
    const t0 = performance.now();
    const result = await mcpCall(session, "tools/list", {});
    const elapsed = (performance.now() - t0).toFixed(0);

    tools = result?.tools || [];
    check(`tools/list responds ${chalk.dim(`(${elapsed}ms)`)}`, true);
    check(`discovered ${tools.length} tool${tools.length !== 1 ? "s" : ""}`, tools.length > 0, "Server returned no tools");
  } catch (err: unknown) {
    check("tools/list responds", false, String(err));
    return [];
  }

  // Call each tool with minimal input
  for (const tool of tools) {
    const minInput = buildMinimalInput(tool);
    try {
      const t0 = performance.now();
      const result = await mcpCall(session, "tools/call", { name: tool.name, arguments: minInput });
      const elapsed = (performance.now() - t0).toFixed(0);

      const content = result?.content;
      const hasContent = Array.isArray(content) && content.length > 0;
      const hasType = hasContent && content.every((c: any) => typeof c.type === "string");

      check(
        `${chalk.cyan(tool.name)} returns valid response ${chalk.dim(`(${elapsed}ms)`)}`,
        hasContent && hasType,
        !hasContent ? "Missing result.content array" : "Content items must have 'type' field"
      );
    } catch (err: unknown) {
      check(`${chalk.cyan(tool.name)} returns valid response`, false, String(err));
    }
  }

  return tools;
}

// ── Phase 3: User-defined tests ─────────────────────────

async function runUserTests(session: McpSession, testCases: TestCase[], discoveredTools: ToolSchema[]) {
  console.log(chalk.bold(`\n  Phase 3: Test Cases (${testCases.length})\n`));

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const label = `test[${i}] ${chalk.cyan(tc.tool)}`;

    // Check tool exists
    const toolExists = discoveredTools.some((t) => t.name === tc.tool);
    if (!toolExists) {
      check(`${label} — tool exists`, false, `Tool "${tc.tool}" not found on server`);
      continue;
    }

    try {
      const t0 = performance.now();
      const result = await mcpCall(session, "tools/call", { name: tc.tool, arguments: tc.input });
      const elapsed = (performance.now() - t0).toFixed(0);

      const content = (result?.content || []) as Array<{ type: string; text?: string }>;
      const textContent = content
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text!)
        .join("\n");

      // Check expect_type
      if (tc.expect_type === "json") {
        try {
          JSON.parse(textContent);
          check(`${label} → response is JSON ${chalk.dim(`(${elapsed}ms)`)}`, true);
        } catch {
          check(`${label} → response is JSON`, false, "Response is not valid JSON");
          continue;
        }
      } else if (tc.expect_type === "text") {
        check(
          `${label} → response is text ${chalk.dim(`(${elapsed}ms)`)}`,
          textContent.length > 0,
          "Response has no text content"
        );
      }

      // Check expect_contains
      if (tc.expect_contains) {
        const contains = textContent.includes(tc.expect_contains);
        check(
          `${label} → contains "${tc.expect_contains}"${!tc.expect_type ? " " + chalk.dim(`(${elapsed}ms)`) : ""}`,
          contains,
          `Response does not contain "${tc.expect_contains}"`
        );
      }

      // Check expect_not_contains
      if (tc.expect_not_contains) {
        const notContains = !textContent.includes(tc.expect_not_contains);
        check(
          `${label} → does not contain "${tc.expect_not_contains}"`,
          notContains,
          `Response unexpectedly contains "${tc.expect_not_contains}"`
        );
      }

      // If no assertions specified, just check it didn't error
      if (!tc.expect_type && !tc.expect_contains && !tc.expect_not_contains) {
        check(`${label} → responds without error ${chalk.dim(`(${elapsed}ms)`)}`, true);
      }
    } catch (err: unknown) {
      check(`${label}`, false, String(err));
    }
  }
}

// ── Main command ────────────────────────────────────────

export async function testCommand(options: { port: string }) {
  console.log(chalk.bold("\n  ⚡ pinch test") + chalk.dim(" — validate and test your MCP server\n"));

  const manifest = await loadManifest();

  // Phase 0: Check manifest exists
  check("pinch.toml exists", manifest !== null, "Run `pinch init` to create one");

  if (!manifest) {
    console.log(chalk.red(`\n  ${failed} failed, ${passed} passed\n`));
    process.exit(1);
  }

  // Phase 1: Manifest validation
  runManifestChecks(manifest);

  if (failed > 0) {
    console.log(`\n  ${chalk.green(passed + " passed")}, ${chalk.red(failed + " failed")}`);
    console.log(chalk.dim("  Fix manifest issues before running live tests.\n"));
    process.exit(1);
  }

  // Phase 2: Live contract tests
  const port = options.port;
  const entryFile = resolve(process.cwd(), "src/index.ts");

  if (!existsSync(entryFile)) {
    console.log(chalk.yellow("\n  No src/index.ts found — skipping live tests.\n"));
    console.log(`\n  ${chalk.green(passed + " passed")}${failed > 0 ? ", " + chalk.red(failed + " failed") : ""}\n`);
    process.exit(failed > 0 ? 1 : 0);
  }

  console.log(chalk.dim(`\n  Starting server on port ${port}...`));

  let child: ChildProcess | null = null;

  try {
    child = spawn("npx", ["tsx", "src/index.ts"], {
      env: { ...process.env, PORT: port },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Capture stderr for debugging
    let serverError = "";
    child.stderr?.on("data", (data: Buffer) => {
      serverError += data.toString();
    });

    child.on("exit", (code) => {
      if (code && code !== 0 && serverError) {
        console.log(chalk.red("  Server stderr: ") + chalk.dim(serverError.slice(0, 200)));
      }
    });

    const baseUrl = `http://localhost:${port}`;
    const endpoint = `${baseUrl}${manifest.tool.mcp.endpoint}`;
    const session = createSession(endpoint);

    const ready = await waitForServer(baseUrl);
    if (!ready) {
      check("server starts within 15s", false, "Server did not respond in time");
      if (serverError) {
        console.log(chalk.dim("  Server output: ") + serverError.slice(0, 300));
      }
      child.kill();
      console.log(`\n  ${chalk.green(passed + " passed")}, ${chalk.red(failed + " failed")}\n`);
      process.exit(1);
    }

    check("server starts within 15s", true);
    console.log(chalk.dim(`  Server ready at ${endpoint}\n`));

    const discoveredTools = await runContractTests(session);

    // Phase 3: User-defined tests
    const testCases = manifest.test || [];
    if (testCases.length > 0) {
      await runUserTests(session, testCases, discoveredTools);
    } else {
      console.log(chalk.dim("\n  No [[test]] cases in pinch.toml — add some for custom assertions."));
    }
  } finally {
    if (child) {
      child.kill();
      // Give it a moment to cleanup
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Summary
  console.log(
    `\n  ${chalk.green(passed + " passed")}${failed > 0 ? ", " + chalk.red(failed + " failed") : ""}` +
      chalk.dim(` (${passed + failed} total)`) +
      "\n"
  );

  if (failed > 0) process.exit(1);
}
