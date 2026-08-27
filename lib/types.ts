import type { ShelfGenreId } from "./genres";

export type TasteSource = "csv" | "rss";

export type GoodreadsBook = {
  goodreadsId: string | null;
  title: string;
  author: string;
  isbn: string | null;
  isbn13: string | null;
  myRating: number;
  averageRating: number;
  dateRead: string | null;
  dateAdded: string | null;
  bookshelves: string[];
  exclusiveShelf: string;
};

export type TasteProfile = {
  source: TasteSource;
  importedAt: string;
  label: string;
  books: GoodreadsBook[];
};

export type DetectedBook = {
  id: string;
  title: string;
  author: string;
  confidence: number;
  isbn?: string | null;
};

export type BookMetadata = {
  coverUrl: string | null;
  isbn: string | null;
  openLibraryUrl: string | null;
  subjects: string[];
  averageRating: number | null;
  ratingsCount: number | null;
};

export type ShelfMatchKind =
  | "already-read"
  | "currently-reading"
  | "queued"
  | "pick"
  | "weak";

export type RankedShelfBook = {
  book: DetectedBook;
  score: number;
  reasons: string[];
  kind: ShelfMatchKind;
  matchedLibrary: GoodreadsBook | null;
  metadata?: BookMetadata;
  popularityScore: number;
  averageRating: number | null;
  ratingsCount: number | null;
  genres: ShelfGenreId[];
};

export type GenreShelfGroup = {
  id: ShelfGenreId;
  label: string;
  books: RankedShelfBook[];
};

export type RankingResult = {
  picks: RankedShelfBook[];
  popular: RankedShelfBook[];
  genres: GenreShelfGroup[];
  alreadyRead: RankedShelfBook[];
  currentlyReading: RankedShelfBook[];
  rest: RankedShelfBook[];
  tasteBookCount: number;
  ratedCount: number;
};

export type TasteSummary = {
  bookCount: number;
  ratedCount: number;
  readCount: number;
  queuedCount: number;
  favoriteAuthors: { author: string; avg: number; count: number }[];
  topShelves: { shelf: string; count: number }[];
};
