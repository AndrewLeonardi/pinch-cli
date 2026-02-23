import chalk from "chalk";
import open from "open";
import { loadConfig, saveConfig, getPlatformUrl } from "../lib/config.js";

export async function loginCommand() {
  console.log(chalk.red("🦞") + chalk.bold(" pinch login") + " — authenticate with Pinchers.ai\n");

  const config = await loadConfig();
  if (config.api_key) {
    console.log(chalk.dim("  Already logged in as ") + chalk.cyan(config.email || "unknown"));
    console.log(chalk.dim("  To re-authenticate, delete ~/.pinchersrc and run again.\n"));
    return;
  }

  const platformUrl = getPlatformUrl();

  // Step 1: Request a one-time code
  console.log(chalk.dim("  Requesting auth code..."));
  let code: string;
  try {
    const res = await fetch(`${platformUrl}/api/cli/code`, { method: "POST" });
    const json = await res.json() as { code: string };
    code = json.code;
  } catch {
    console.log(chalk.red("  Could not reach Pinchers.ai. Check your internet connection.\n"));
    process.exit(1);
  }

  // Step 2: Open browser for user to confirm
  const authUrl = `${platformUrl}/cli/auth?code=${code}`;
  console.log(chalk.dim("  Opening browser for authentication..."));
  console.log(`  ${chalk.cyan(authUrl)}\n`);
  await open(authUrl);

  // Step 3: Poll for verification
  console.log(chalk.dim("  Waiting for you to confirm in the browser..."));
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`${platformUrl}/api/cli/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const json = await res.json() as { api_key: string; email: string; key_prefix: string };
        await saveConfig({ api_key: json.api_key, email: json.email });
        console.log(chalk.green(`\n  ✓ Logged in as ${json.email}`));
        console.log(chalk.dim(`  API key: ${json.key_prefix}...`));
        console.log(chalk.dim("  Saved to ~/.pinchersrc\n"));
        return;
      }
      if (res.status === 202) {
        // Still pending
        continue;
      }
      if (res.status === 410) {
        console.log(chalk.red("\n  Auth code expired. Run `pinch login` again.\n"));
        process.exit(1);
      }
    } catch {
      // Network error, keep trying
    }
  }

  console.log(chalk.red("\n  Timed out waiting for authentication. Run `pinch login` again.\n"));
  process.exit(1);
}
