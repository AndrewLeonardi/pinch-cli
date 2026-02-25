import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import * as toml from "toml";

// ── RC file paths (new + legacy) ──────────────────────
const RC_PATH = join(homedir(), ".pinchrc");
const LEGACY_RC_PATH = join(homedir(), ".pinchersrc");

// ── Platform URLs ─────────────────────────────────────
const PINCHERS_URL = process.env.PINCHERS_URL || "https://pinchers.ai";

export type DeployTarget = "cloudflare" | "docker" | "pinchers";

export interface PinchConfig {
  /** API key for Pinchers.ai marketplace (optional — only needed for `deploy pinchers`) */
  api_key?: string;
  email?: string;
  /** Cloudflare API token (optional — only needed for `deploy cloudflare`) */
  cf_api_token?: string;
  cf_account_id?: string;
}

export interface TestCase {
  tool: string;
  input: Record<string, unknown>;
  expect_type?: "text" | "json";
  expect_contains?: string;
  expect_not_contains?: string;
}

export interface PinchManifest {
  tool: {
    name: string;
    slug: string;
    description: string;
    version: string;
    category: string;
    tags: string[];
    mcp: {
      endpoint: string;
      transport: string;
    };
    artifacts?: {
      endpoint: string;
      types: string[];
    };
    pricing?: {
      type: "free" | "credits";
      credit_cost?: number;
    };
    ui?: {
      type: "auto" | "custom";
      entry?: string;
    };
  };
  deploy?: {
    target?: DeployTarget;
    /** Cloudflare Worker name (defaults to slug) */
    worker_name?: string;
    /** Docker image name (defaults to slug) */
    image_name?: string;
  };
  test?: TestCase[];
}

// Legacy type aliases for backward compatibility
export type PinchersConfig = PinchConfig;
export type PinchersManifest = PinchManifest;

export function getPlatformUrl(): string {
  return PINCHERS_URL;
}

/**
 * Load config from (in priority order):
 * 1. Project-local .pinchrc (in cwd)
 * 2. Environment variables (PINCH_CF_API_TOKEN, PINCH_CF_ACCOUNT_ID)
 * 3. Global ~/.pinchrc
 * 4. Legacy ~/.pinchersrc
 */
export async function loadConfig(): Promise<PinchConfig> {
  let config: PinchConfig = {};

  // Global config (legacy fallback)
  const globalPath = existsSync(RC_PATH) ? RC_PATH : LEGACY_RC_PATH;
  if (existsSync(globalPath)) {
    try {
      config = JSON.parse(await readFile(globalPath, "utf-8"));
    } catch {
      // Invalid JSON — start fresh
    }
  }

  // Project-local .pinchrc overrides global
  const localPath = resolve(process.cwd(), ".pinchrc");
  if (existsSync(localPath)) {
    try {
      const local = JSON.parse(await readFile(localPath, "utf-8"));
      config = { ...config, ...local };
    } catch {
      // Invalid JSON — ignore local
    }
  }

  // Environment variables override everything
  if (process.env.PINCH_CF_API_TOKEN) config.cf_api_token = process.env.PINCH_CF_API_TOKEN;
  if (process.env.PINCH_CF_ACCOUNT_ID) config.cf_account_id = process.env.PINCH_CF_ACCOUNT_ID;

  return config;
}

/**
 * Save config to ~/.pinchrc
 */
export async function saveConfig(config: PinchConfig): Promise<void> {
  await writeFile(RC_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function getConfigPath(): string {
  if (existsSync(RC_PATH)) return RC_PATH;
  if (existsSync(LEGACY_RC_PATH)) return LEGACY_RC_PATH;
  return RC_PATH; // default for new installs
}

/**
 * Load manifest from pinch.toml (falls back to legacy pinchers.toml)
 */
export async function loadManifest(dir?: string): Promise<PinchManifest | null> {
  const base = dir || process.cwd();
  const newPath = resolve(base, "pinch.toml");
  const legacyPath = resolve(base, "pinchers.toml");

  const manifestPath = existsSync(newPath)
    ? newPath
    : existsSync(legacyPath)
    ? legacyPath
    : null;

  if (!manifestPath) return null;
  const raw = await readFile(manifestPath, "utf-8");
  return toml.parse(raw) as PinchManifest;
}

export function getApiKey(config: PinchConfig): string | null {
  return config.api_key || null;
}
