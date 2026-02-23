import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import * as toml from "toml";

const RC_PATH = join(homedir(), ".pinchersrc");
const PLATFORM_URL = process.env.PINCHERS_URL || "https://pinchers.ai";

export interface PinchersConfig {
  api_key?: string;
  email?: string;
}

export interface TestCase {
  tool: string;
  input: Record<string, unknown>;
  expect_type?: "text" | "json";
  expect_contains?: string;
  expect_not_contains?: string;
}

export interface PinchersManifest {
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
  };
  test?: TestCase[];
}

export function getPlatformUrl(): string {
  return PLATFORM_URL;
}

export async function loadConfig(): Promise<PinchersConfig> {
  if (!existsSync(RC_PATH)) return {};
  const raw = await readFile(RC_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function saveConfig(config: PinchersConfig): Promise<void> {
  await writeFile(RC_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export async function loadManifest(dir?: string): Promise<PinchersManifest | null> {
  const manifestPath = resolve(dir || process.cwd(), "pinchers.toml");
  if (!existsSync(manifestPath)) return null;
  const raw = await readFile(manifestPath, "utf-8");
  return toml.parse(raw) as PinchersManifest;
}

export function getApiKey(config: PinchersConfig): string | null {
  return config.api_key || null;
}
