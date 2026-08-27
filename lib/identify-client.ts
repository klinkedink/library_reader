import { interpretIdentifyError, isFatalIdentifyStatus } from "./identify-error";
import { coerceIdentifyBooks } from "./identify-output";
import { dedupeDetected } from "./shelf";
import type { DetectedBook } from "./types";

export type TileBook = {
  title?: string;
  author?: string;
  confidence?: number;
};

export class IdentifyClientError extends Error {
  fatal: boolean;
  kind: string;
  status?: number;

  constructor(message: string, opts: { fatal: boolean; kind: string; status?: number }) {
    super(message);
    this.name = "IdentifyClientError";
    this.fatal = opts.fatal;
    this.kind = opts.kind;
    this.status = opts.status;
  }
}

export function booksFromTilePayload(books: TileBook[] | undefined): DetectedBook[] {
  if (!books?.length) return [];
  return dedupeDetected(
    books
      .filter((book): book is { title: string; author?: string; confidence?: number } =>
        Boolean(book.title?.trim()),
      )
      .map((book) => ({
        id: `${book.title}|${book.author ?? ""}`.toLowerCase(),
        title: book.title,
        author: book.author ?? "",
        confidence: book.confidence ?? 0.5,
      })),
  );
}

/**
 * Turn an /api/identify HTTP result into books.
 * A 200 with `{ books: [] }` is a real empty tile.
 * A 200 without a `books` array is a parse failure, not an empty shelf.
 */
export function readIdentifyHttpResult(status: number, text: string): DetectedBook[] {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (status < 200 || status >= 300) {
    const interpreted = interpretIdentifyError(parsed ?? text, status);
    if (!interpreted.fatal && isFatalIdentifyStatus(status)) {
      interpreted.fatal = true;
    }
    throw new IdentifyClientError(interpreted.message, {
      fatal: interpreted.fatal,
      kind: interpreted.kind,
      status,
    });
  }

  const coerced = coerceIdentifyBooks(parsed);
  if (!coerced) {
    throw new IdentifyClientError(
      `HTTP ${status} from /api/identify was missing a books array — the vision output did not parse. This is not an empty shelf.`,
      { fatal: false, kind: "parse", status },
    );
  }

  return booksFromTilePayload(coerced.books);
}

export async function identifyTile(
  dataUrl: string,
  signal?: AbortSignal,
): Promise<DetectedBook[]> {
  const res = await fetch("/api/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl }),
    signal,
  });

  const text = await res.text();
  return readIdentifyHttpResult(res.status, text);
}
