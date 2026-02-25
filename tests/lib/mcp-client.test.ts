import { describe, it, expect } from "vitest";
import { createSession, buildMinimalInput, type ToolSchema } from "../../src/lib/mcp-client.js";

describe("createSession", () => {
  it("creates a session with null sessionId", () => {
    const session = createSession("http://localhost:3100/mcp");
    expect(session.sessionId).toBeNull();
    expect(session.msgId).toBe(1);
    expect(session.endpoint).toBe("http://localhost:3100/mcp");
  });
});

describe("buildMinimalInput", () => {
  it("generates string for required string fields", () => {
    const schema: ToolSchema = {
      name: "test",
      inputSchema: {
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    };
    expect(buildMinimalInput(schema)).toEqual({ name: "test" });
  });

  it("generates number for required number fields", () => {
    const schema: ToolSchema = {
      name: "test",
      inputSchema: {
        properties: { count: { type: "number" } },
        required: ["count"],
      },
    };
    expect(buildMinimalInput(schema)).toEqual({ count: 1 });
  });

  it("generates boolean for required boolean fields", () => {
    const schema: ToolSchema = {
      name: "test",
      inputSchema: {
        properties: { active: { type: "boolean" } },
        required: ["active"],
      },
    };
    expect(buildMinimalInput(schema)).toEqual({ active: true });
  });

  it("uses first enum value when available", () => {
    const schema: ToolSchema = {
      name: "test",
      inputSchema: {
        properties: { format: { type: "string", enum: ["json", "text", "csv"] } },
        required: ["format"],
      },
    };
    expect(buildMinimalInput(schema)).toEqual({ format: "json" });
  });

  it("skips optional fields", () => {
    const schema: ToolSchema = {
      name: "test",
      inputSchema: {
        properties: {
          required_field: { type: "string" },
          optional_field: { type: "string" },
        },
        required: ["required_field"],
      },
    };
    const input = buildMinimalInput(schema);
    expect(input).toHaveProperty("required_field");
    expect(input).not.toHaveProperty("optional_field");
  });

  it("handles empty schema", () => {
    const schema: ToolSchema = { name: "test" };
    expect(buildMinimalInput(schema)).toEqual({});
  });

  it("handles integer type", () => {
    const schema: ToolSchema = {
      name: "test",
      inputSchema: {
        properties: { id: { type: "integer" } },
        required: ["id"],
      },
    };
    expect(buildMinimalInput(schema)).toEqual({ id: 1 });
  });
});
