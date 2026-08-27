import { describe, expect, it } from "vitest";
import { z } from "zod";
import { identifyResponseSchema } from "./vision";

function assertOpenAiStrictObject(schema: Record<string, unknown>, path: string) {
  if (schema.type !== "object" && !(Array.isArray(schema.type) && schema.type.includes("object"))) {
    return;
  }
  const properties = schema.properties as Record<string, unknown> | undefined;
  if (!properties) return;
  const keys = Object.keys(properties);
  const required = schema.required;
  expect(Array.isArray(required), `${path} must have required[]`).toBe(true);
  expect([...(required as string[])].sort(), `${path} required must include every property`).toEqual(
    [...keys].sort(),
  );
  for (const [key, value] of Object.entries(properties)) {
    walk(value, `${path}.properties.${key}`);
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    walk(schema.additionalProperties, `${path}.additionalProperties`);
  }
}

function walk(node: unknown, path: string) {
  if (!node || typeof node !== "object") return;
  const schema = node as Record<string, unknown>;
  if (schema.items) {
    if (Array.isArray(schema.items)) {
      schema.items.forEach((item, i) => walk(item, `${path}.items[${i}]`));
    } else {
      walk(schema.items, `${path}.items`);
    }
  }
  assertOpenAiStrictObject(schema, path);
}

describe("identifyResponseSchema OpenAI strict mode", () => {
  it("lists every property in required (AI SDK converts Zod with io: input)", () => {
    const json = z.toJSONSchema(identifyResponseSchema, {
      target: "draft-7",
      io: "input",
    }) as Record<string, unknown>;
    walk(json, "ShelfBooks");
    const items = (json.properties as { books: { items: { required: string[]; properties: object } } })
      .books.items;
    expect(items.required.sort()).toEqual(["author", "confidence", "title"]);
    expect(Object.keys(items.properties).sort()).toEqual(["author", "confidence", "title"]);
  });
});
