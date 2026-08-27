import type { GoodreadsBook } from "./types";
import { stripIsbnDecorations } from "./normalize";

export class RssParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RssParseError";
  }
}

export function extractGoodreadsUserId(input: string): string | null {
  const trimmed = input.trim();
  const show = trimmed.match(/goodreads\.com\/user\/show\/(\d+)/i);
  if (show) return show[1];
  const list = trimmed.match(/goodreads\.com\/review\/list\/(\d+)/i);
  if (list) return list[1];
  const rss = trimmed.match(/goodreads\.com\/review\/list_rss\/(\d+)/i);
  if (rss) return rss[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

export function goodreadsRssUrl(userId: string, shelf: string): string {
  return `https://www.goodreads.com/review/list_rss/${encodeURIComponent(userId)}?shelf=${encodeURIComponent(shelf)}`;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

export function parseGoodreadsRss(xml: string, exclusiveShelf: string): GoodreadsBook[] {
  if (!xml.includes("<item")) {
    if (xml.includes("<rss") || xml.includes("<channel")) return [];
    throw new RssParseError("Goodreads did not return an RSS feed. Is the profile public?");
  }

  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const books: GoodreadsBook[] = [];

  for (const item of items) {
    const title = tag(item, "title");
    if (!title) continue;
    const author = tag(item, "author_name") || tag(item, "author");
    const userRating = Number.parseInt(tag(item, "user_rating"), 10);
    const averageRating = Number.parseFloat(tag(item, "average_rating"));

    books.push({
      goodreadsId: tag(item, "book_id") || null,
      title,
      author,
      isbn: stripIsbnDecorations(tag(item, "isbn")),
      isbn13: stripIsbnDecorations(tag(item, "isbn13")),
      myRating: Number.isFinite(userRating) ? userRating : 0,
      averageRating: Number.isFinite(averageRating) ? averageRating : 0,
      dateRead: tag(item, "user_read_at") || null,
      dateAdded: tag(item, "user_date_added") || null,
      bookshelves: [exclusiveShelf],
      exclusiveShelf,
    });
  }

  return books;
}

export function mergeRssShelves(
  shelves: { shelf: string; books: GoodreadsBook[] }[],
): GoodreadsBook[] {
  const byKey = new Map<string, GoodreadsBook>();
  const rank = (shelf: string) =>
    shelf === "currently-reading" ? 3 : shelf === "to-read" ? 2 : 1;

  for (const { books } of shelves) {
    for (const book of books) {
      const key = `${book.goodreadsId ?? ""}|${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
      const existing = byKey.get(key);
      if (!existing || rank(book.exclusiveShelf) >= rank(existing.exclusiveShelf)) {
        byKey.set(key, book);
      }
    }
  }

  return [...byKey.values()];
}
