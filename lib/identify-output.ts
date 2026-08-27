import type { z } from "zod";
import { identifyResponseSchema } from "./vision";

export type IdentifyBooks = z.infer<typeof identifyResponseSchema>;
export type IdentifiedSpine = IdentifyBooks["books"][number];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Accept the documented `{ books: [...] }` object, plus a raw array in case a
 * provider/model emits the old generateObject-array shape.
 */
function softenBookList(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (typeof item === "string") {
      return { title: item, author: "", confidence: 0.5 };
    }
    const rec = asRecord(item);
    if (!rec) return item;
    return {
      title: rec.title,
      author: typeof rec.author === "string" ? rec.author : "",
      confidence: typeof rec.confidence === "number" ? rec.confidence : 0.5,
    };
  });
}

export function coerceIdentifyBooks(value: unknown): IdentifyBooks | null {
  if (value == null) return null;

  if (Array.isArray(value)) {
    const parsed = identifyResponseSchema.safeParse({ books: softenBookList(value) });
    return parsed.success ? parsed.data : null;
  }

  const rec = asRecord(value);
  if (!rec) return null;

  if (Array.isArray(rec.books)) {
    const parsed = identifyResponseSchema.safeParse({ ...rec, books: softenBookList(rec.books) });
    return parsed.success ? parsed.data : null;
  }

  if (Array.isArray(rec.object)) {
    const parsed = identifyResponseSchema.safeParse({ books: softenBookList(rec.object) });
    return parsed.success ? parsed.data : null;
  }

  return null;
}

function jsonSlice(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  const obj = body.indexOf("{");
  const arr = body.indexOf("[");
  if (obj === -1 && arr === -1) return null;
  const start =
    obj === -1 ? arr : arr === -1 ? obj : Math.min(obj, arr);
  const closer = body[start] === "[" ? "]" : "}";
  const end = body.lastIndexOf(closer);
  if (end <= start) return null;
  return body.slice(start, end + 1);
}

export function parseIdentifyBooksFromText(text: string | undefined | null): IdentifyBooks | null {
  if (!text?.trim()) return null;
  const slice = jsonSlice(text);
  if (!slice) return null;
  try {
    return coerceIdentifyBooks(JSON.parse(slice));
  } catch {
    return null;
  }
}
