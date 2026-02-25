/**
 * Pinch Tool Package format — the portable JSON format for full-stack MCP tools.
 *
 * A package contains everything needed to scaffold and deploy a tool:
 * - source_code: The main MCP server code (src/tools.ts or src/index.ts)
 * - ui_files: Optional frontend files (ui/ directory)
 * - server_files: Optional additional server modules
 * - schema_sql: Optional D1 database schema
 * - metadata: Tool name, slug, description, category, version, tags
 */

export interface ToolPackage {
  /** Tool metadata */
  name: string;
  slug: string;
  description: string;
  category: string;
  version?: string;
  tags?: string[];

  /** Main MCP server code (contents of src/tools.ts or src/index.ts) */
  source_code: string;

  /** Optional UI files — key is relative path, value is file content */
  ui_files?: Record<string, string>;

  /** Optional additional server modules — key is relative path, value is file content */
  server_files?: Record<string, string>;

  /** Optional D1 database schema SQL */
  schema_sql?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePackage(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Package must be a JSON object"], warnings };
  }

  const pkg = data as Record<string, unknown>;

  // Required fields
  if (!pkg.name || typeof pkg.name !== "string") {
    errors.push("Missing or invalid 'name' field (string required)");
  }
  if (!pkg.source_code || typeof pkg.source_code !== "string") {
    errors.push("Missing or invalid 'source_code' field (string required)");
  }

  // Generate slug from name if missing
  if (!pkg.slug) {
    if (pkg.name && typeof pkg.name === "string") {
      warnings.push("No 'slug' provided — will auto-generate from name");
    } else {
      errors.push("Missing 'slug' and 'name' fields — at least one is required");
    }
  }

  if (!pkg.description || typeof pkg.description !== "string") {
    warnings.push("Missing 'description' — consider adding one");
  }

  if (!pkg.category || typeof pkg.category !== "string") {
    warnings.push("Missing 'category' — will default to 'other'");
  }

  // Optional fields type-check
  if (pkg.ui_files !== undefined && (typeof pkg.ui_files !== "object" || pkg.ui_files === null)) {
    errors.push("'ui_files' must be an object mapping file paths to content strings");
  }

  if (pkg.server_files !== undefined && (typeof pkg.server_files !== "object" || pkg.server_files === null)) {
    errors.push("'server_files' must be an object mapping file paths to content strings");
  }

  if (pkg.schema_sql !== undefined && typeof pkg.schema_sql !== "string") {
    errors.push("'schema_sql' must be a string");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function packageToManifest(pkg: ToolPackage): string {
  return `[tool]
name = "${pkg.name}"
slug = "${pkg.slug}"
description = "${(pkg.description || "").replace(/"/g, '\\"')}"
version = "${pkg.version || "0.1.0"}"
category = "${pkg.category || "other"}"
tags = [${(pkg.tags || []).map((t) => `"${t}"`).join(", ")}]

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "free"
`;
}
