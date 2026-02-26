#!/usr/bin/env node

/**
 * pinch — The simplest way to learn MCP and launch an MCP product.
 *
 * One command. Opens a browser. Three steps: Learn → Build → Ship.
 */

import { startServer } from "./server.js";
import open from "open";

const port = parseInt(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] || "3100");
const noBrowser = process.argv.includes("--no-browser");

async function main() {
  const url = await startServer(port);

  console.log(`\n  🦞 pinch is running at ${url}\n`);

  if (!noBrowser) {
    await open(url);
  }
}

main().catch((err) => {
  console.error("Failed to start pinch:", err.message);
  process.exit(1);
});
