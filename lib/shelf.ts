import type { DetectedBook } from "./types";
import { authorsMatch, bookKey, titlesSimilar } from "./normalize";

export function newBookId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `book_${Math.random().toString(36).slice(2, 10)}`;
}

export function dedupeDetected(books: DetectedBook[]): DetectedBook[] {
  const out: DetectedBook[] = [];

  for (const book of books) {
    const title = book.title?.trim();
    if (!title) continue;
    const author = book.author?.trim() ?? "";
    const cleaned: DetectedBook = {
      ...book,
      title,
      author,
      confidence: clamp01(book.confidence ?? 0),
    };

    const existing = out.find((item) => {
      const sameKey = bookKey(item.title, item.author) === bookKey(cleaned.title, cleaned.author);
      if (sameKey) return true;
      const similarTitle = titlesSimilar(item.title, cleaned.title);
      if (!similarTitle) return false;
      if (!item.author || !cleaned.author) return true;
      return authorsMatch(item.author, cleaned.author);
    });

    if (!existing) {
      out.push(cleaned);
      continue;
    }

    if (cleaned.confidence > existing.confidence) {
      existing.title = cleaned.title;
      existing.author = cleaned.author || existing.author;
      existing.confidence = cleaned.confidence;
      existing.isbn = cleaned.isbn || existing.isbn;
    } else if (!existing.author && cleaned.author) {
      existing.author = cleaned.author;
    }
  }

  return out;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
