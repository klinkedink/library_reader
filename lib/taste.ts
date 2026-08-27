import type { GoodreadsBook, TasteSummary } from "./types";
import { authorsMatch, fold, parseAuthor } from "./normalize";

const META_SHELVES = new Set([
  "to-read",
  "currently-reading",
  "read",
  "owned",
  "kindle",
  "audible",
  "audio",
  "audiobook",
  "ebook",
  "physical",
  "library",
  "borrowed",
  "dnf",
  "abandoned",
  "favorites",
  "favourites",
  "gave-up",
]);

export function isGenreShelf(shelf: string): boolean {
  const key = fold(shelf).replace(/\s+/g, "-");
  if (META_SHELVES.has(key)) return false;
  if (/^\d{4}$/.test(key)) return false;
  if (/^\d{4}-reads?$/.test(key)) return false;
  return key.length > 1;
}

export function isRead(book: GoodreadsBook): boolean {
  const shelf = fold(book.exclusiveShelf);
  return shelf === "read" || Boolean(book.dateRead);
}

export function isQueued(book: GoodreadsBook): boolean {
  return fold(book.exclusiveShelf) === "to-read";
}

export function isCurrentlyReading(book: GoodreadsBook): boolean {
  return fold(book.exclusiveShelf) === "currently-reading";
}

export type AuthorStats = {
  author: string;
  count: number;
  ratedCount: number;
  avg: number;
  titles: GoodreadsBook[];
  shelves: string[];
};

export type TasteModel = {
  books: GoodreadsBook[];
  authors: AuthorStats[];
  shelfWeights: Map<string, { weight: number; example: GoodreadsBook }>;
  highRated: GoodreadsBook[];
};

export function buildTasteModel(books: GoodreadsBook[]): TasteModel {
  const authorBuckets = new Map<string, GoodreadsBook[]>();

  for (const book of books) {
    const last = parseAuthor(book.author).last || fold(book.author);
    if (!last) continue;
    const bucket = authorBuckets.get(last) ?? [];
    bucket.push(book);
    authorBuckets.set(last, bucket);
  }

  const authors: AuthorStats[] = [];
  for (const bucket of authorBuckets.values()) {
    const rated = bucket.filter((b) => b.myRating > 0);
    const avg = rated.length
      ? rated.reduce((sum, b) => sum + b.myRating, 0) / rated.length
      : 0;
    const representative =
      [...bucket].sort((a, b) => b.myRating - a.myRating)[0]?.author ?? bucket[0].author;
    const shelves = bucket.flatMap((b) => b.bookshelves).filter(isGenreShelf);
    authors.push({
      author: representative,
      count: bucket.length,
      ratedCount: rated.length,
      avg,
      titles: bucket,
      shelves,
    });
  }

  authors.sort((a, b) => b.avg * b.ratedCount - a.avg * a.ratedCount);

  const shelfWeights = new Map<string, { weight: number; example: GoodreadsBook }>();
  const highRated = books.filter((b) => b.myRating >= 4);

  for (const book of highRated) {
    for (const shelf of book.bookshelves.filter(isGenreShelf)) {
      const key = fold(shelf).replace(/\s+/g, "-");
      const current = shelfWeights.get(key);
      const add = book.myRating >= 5 ? 2 : 1;
      if (!current) {
        shelfWeights.set(key, { weight: add, example: book });
      } else {
        current.weight += add;
        if (book.myRating > current.example.myRating) current.example = book;
      }
    }
  }

  return { books, authors, shelfWeights, highRated };
}

export function summarizeTaste(books: GoodreadsBook[]): TasteSummary {
  const model = buildTasteModel(books);
  const favoriteAuthors = model.authors
    .filter((a) => a.ratedCount > 0 && a.avg >= 4)
    .slice(0, 4)
    .map((a) => ({ author: a.author, avg: round1(a.avg), count: a.ratedCount }));

  const topShelves = [...model.shelfWeights.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 5)
    .map(([shelf, info]) => ({ shelf, count: info.weight }));

  return {
    bookCount: books.length,
    ratedCount: books.filter((b) => b.myRating > 0).length,
    readCount: books.filter(isRead).length,
    queuedCount: books.filter(isQueued).length,
    favoriteAuthors,
    topShelves,
  };
}

export function findAuthorStats(model: TasteModel, author: string): AuthorStats | null {
  if (!author.trim()) return null;
  return (
    model.authors.find((entry) =>
      entry.titles.some((book) => authorsMatch(book.author, author)),
    ) ?? null
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
