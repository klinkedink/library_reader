import type { GoodreadsBook } from "./types";
import { stripIsbnDecorations } from "./normalize";

const REQUIRED_COLUMNS = ["title", "author", "exclusive shelf"] as const;

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (ch === "\r") {
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function headerIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    map.set(header.trim().toLowerCase(), index);
  });
  return map;
}

function cell(row: string[], index: Map<string, number>, name: string): string {
  const i = index.get(name);
  if (i === undefined) return "";
  return (row[i] ?? "").trim();
}

function parseRating(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function parseShelves(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseGoodreadsCsv(text: string): GoodreadsBook[] {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new CsvParseError("That CSV looks empty. Export My Books from Goodreads and try again.");
  }

  const index = headerIndex(rows[0]);
  for (const required of REQUIRED_COLUMNS) {
    if (!index.has(required)) {
      throw new CsvParseError(
        `This doesn't look like a Goodreads export. Missing column “${required}”. Use My Books → Import and export → Export.`,
      );
    }
  }

  const books: GoodreadsBook[] = [];
  for (const row of rows.slice(1)) {
    const title = cell(row, index, "title");
    const author = cell(row, index, "author") || cell(row, index, "author l-f");
    if (!title) continue;

    books.push({
      goodreadsId: cell(row, index, "book id") || null,
      title,
      author,
      isbn: stripIsbnDecorations(cell(row, index, "isbn")),
      isbn13: stripIsbnDecorations(cell(row, index, "isbn13")),
      myRating: Math.round(parseRating(cell(row, index, "my rating"))),
      averageRating: parseRating(cell(row, index, "average rating")),
      dateRead: cell(row, index, "date read") || null,
      dateAdded: cell(row, index, "date added") || null,
      bookshelves: parseShelves(cell(row, index, "bookshelves")),
      exclusiveShelf: cell(row, index, "exclusive shelf") || "read",
    });
  }

  if (books.length === 0) {
    throw new CsvParseError("The export parsed, but no book titles were found.");
  }

  return books;
}
