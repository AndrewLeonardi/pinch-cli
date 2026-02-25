/**
 * File bundling utilities for deploy and export commands.
 */

import { readFile, readdir } from "fs/promises";
import { resolve, join, relative } from "path";
import { existsSync } from "fs";

async function readDirRecursive(
  dir: string,
  baseDir: string,
  skipNames: string[] = []
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      const nested = await readDirRecursive(fullPath, baseDir, skipNames);
      Object.assign(files, nested);
    } else if (entry.isFile() && !skipNames.includes(entry.name)) {
      const relPath = relative(baseDir, fullPath);
      files[relPath] = await readFile(fullPath, "utf-8");
    }
  }

  return files;
}

export async function bundleUIDirectory(): Promise<Record<string, string> | null> {
  const uiDir = resolve(process.cwd(), "ui");
  if (!existsSync(uiDir)) return null;

  const files = await readDirRecursive(uiDir, uiDir);
  return Object.keys(files).length > 0 ? files : null;
}

export async function bundleServerFiles(): Promise<Record<string, string> | null> {
  const srcDir = resolve(process.cwd(), "src");
  if (!existsSync(srcDir)) return null;

  const files = await readDirRecursive(srcDir, srcDir, [
    "index.ts",
    "_worker.ts",
  ]);
  return Object.keys(files).length > 0 ? files : null;
}

export async function readSourceCode(): Promise<string> {
  // Try tools.ts first (new pattern), then index.ts (legacy)
  const toolsPath = resolve(process.cwd(), "src/tools.ts");
  const indexPath = resolve(process.cwd(), "src/index.ts");

  if (existsSync(toolsPath)) {
    return readFile(toolsPath, "utf-8");
  }
  return readFile(indexPath, "utf-8");
}

export async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(resolve(process.cwd(), path), "utf-8");
  } catch {
    return null;
  }
}
