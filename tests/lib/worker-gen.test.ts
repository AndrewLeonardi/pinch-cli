import { describe, it, expect } from "vitest";
import {
  generateWorkerEntry,
  generateWranglerConfig,
  detectStorageUsage,
  detectD1Usage,
} from "../../src/lib/worker-gen.js";

describe("detectStorageUsage", () => {
  it("detects storage.get", () => {
    expect(detectStorageUsage("await storage.get('key')")).toBe(true);
  });

  it("detects storage.set", () => {
    expect(detectStorageUsage("await storage.set('key', 'value')")).toBe(true);
  });

  it("detects storage.delete", () => {
    expect(detectStorageUsage("storage.delete('key')")).toBe(true);
  });

  it("detects storage.keys", () => {
    expect(detectStorageUsage("const keys = await storage.keys()")).toBe(true);
  });

  it("returns false when no storage used", () => {
    expect(detectStorageUsage("const x = 42;")).toBe(false);
  });
});

describe("detectD1Usage", () => {
  it("detects env.DB", () => {
    expect(detectD1Usage('env.DB.prepare("SELECT *")')).toBe(true);
  });

  it("returns false when no D1 used", () => {
    expect(detectD1Usage("const db = new Map()")).toBe(false);
  });
});

describe("generateWorkerEntry", () => {
  it("generates valid TypeScript", () => {
    const code = generateWorkerEntry({
      name: "Test Tool",
      version: "1.0.0",
      usesStorage: false,
      usesD1: false,
    });
    expect(code).toContain("McpAgent");
    expect(code).toContain("Test Tool");
    expect(code).toContain("export default");
  });

  it("includes storage bindings when usesStorage is true", () => {
    const code = generateWorkerEntry({
      name: "Test",
      version: "1.0.0",
      usesStorage: true,
      usesD1: false,
    });
    expect(code).toContain("TOOL_KV");
  });
});

describe("generateWranglerConfig", () => {
  it("generates basic wrangler.toml", () => {
    const config = generateWranglerConfig("test-tool", "Test Tool");
    expect(config).toContain('name = "test-tool"');
    expect(config).toContain("compatibility_date");
    expect(config).toContain("durable_objects");
  });

  it("includes KV binding when storage is used", () => {
    const config = generateWranglerConfig("test", "Test", {
      usesStorage: true,
      kvId: "abc123",
    });
    expect(config).toContain("TOOL_KV");
    expect(config).toContain("abc123");
  });

  it("includes D1 binding when database is used", () => {
    const config = generateWranglerConfig("test", "Test", {
      usesD1: true,
      d1DatabaseId: "def456",
    });
    expect(config).toContain("d1_databases");
    expect(config).toContain("def456");
  });
});
