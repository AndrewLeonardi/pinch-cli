import { describe, it, expect } from "vitest";
import { validatePackage, slugify, packageToManifest } from "../../src/lib/package-format.js";

describe("validatePackage", () => {
  it("accepts a valid minimal package", () => {
    const result = validatePackage({
      name: "Test Tool",
      slug: "test-tool",
      description: "A test tool",
      category: "other",
      source_code: 'export function registerTools() {}',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects non-object input", () => {
    expect(validatePackage(null).valid).toBe(false);
    expect(validatePackage("string").valid).toBe(false);
    expect(validatePackage(42).valid).toBe(false);
  });

  it("requires name field", () => {
    const result = validatePackage({ source_code: "code" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("requires source_code field", () => {
    const result = validatePackage({ name: "Test" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("source_code"))).toBe(true);
  });

  it("warns about missing optional fields", () => {
    const result = validatePackage({
      name: "Test",
      source_code: "code",
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects invalid ui_files type", () => {
    const result = validatePackage({
      name: "Test",
      source_code: "code",
      ui_files: "not an object",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("ui_files"))).toBe(true);
  });

  it("accepts valid ui_files", () => {
    const result = validatePackage({
      name: "Test",
      slug: "test",
      description: "desc",
      category: "other",
      source_code: "code",
      ui_files: { "index.html": "<html></html>" },
    });
    expect(result.valid).toBe(true);
  });
});

describe("slugify", () => {
  it("converts name to lowercase slug", () => {
    expect(slugify("My Cool Tool")).toBe("my-cool-tool");
  });

  it("removes special characters", () => {
    expect(slugify("Tool@#$Name!")).toBe("tool-name");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

describe("packageToManifest", () => {
  it("generates valid TOML-like manifest", () => {
    const manifest = packageToManifest({
      name: "Test Tool",
      slug: "test-tool",
      description: "A test",
      category: "productivity",
      source_code: "",
    });
    expect(manifest).toContain('name = "Test Tool"');
    expect(manifest).toContain('slug = "test-tool"');
    expect(manifest).toContain('category = "productivity"');
    expect(manifest).toContain('endpoint = "/mcp"');
  });

  it("includes tags when provided", () => {
    const manifest = packageToManifest({
      name: "Test",
      slug: "test",
      description: "",
      category: "other",
      source_code: "",
      tags: ["ai", "tools"],
    });
    expect(manifest).toContain('"ai"');
    expect(manifest).toContain('"tools"');
  });

  it("defaults version to 0.1.0", () => {
    const manifest = packageToManifest({
      name: "Test",
      slug: "test",
      description: "",
      category: "other",
      source_code: "",
    });
    expect(manifest).toContain('version = "0.1.0"');
  });
});
