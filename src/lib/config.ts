/**
 * Credential storage (~/.pinchrc).
 * Stores API keys for Pinchers.ai and Cloudflare.
 */

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const RC_PATH = join(homedir(), ".pinchrc");
const PINCHERS_URL = process.env.PINCHERS_URL || "https://pinchers.vercel.app";

export interface PinchConfig {
  api_key?: string;
  email?: string;
  cf_api_token?: string;
  cf_account_id?: string;
}

export function getPlatformUrl(): string {
  return PINCHERS_URL;
}

export async function loadConfig(): Promise<PinchConfig> {
  if (!existsSync(RC_PATH)) return {};

  try {
    return JSON.parse(await readFile(RC_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export async function saveConfig(config: PinchConfig): Promise<void> {
  const existing = await loadConfig();
  const merged = { ...existing, ...config };
  await writeFile(RC_PATH, JSON.stringify(merged, null, 2), "utf-8");
}
