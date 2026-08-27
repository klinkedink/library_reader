import {
  extractGoodreadsUserId,
  goodreadsRssUrl,
  mergeRssShelves,
  parseGoodreadsRss,
} from "@/lib/rss";
import type { GoodreadsBook } from "@/lib/types";

export const maxDuration = 30;

const SHELVES = ["read", "currently-reading", "to-read"] as const;

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const userId = extractGoodreadsUserId(body.url ?? "");
  if (!userId) {
    return Response.json(
      {
        error: "bad_url",
        message:
          "Paste a public Goodreads profile URL like https://www.goodreads.com/user/show/12345-name",
      },
      { status: 400 },
    );
  }

  const results: { shelf: string; books: GoodreadsBook[] }[] = [];
  const errors: string[] = [];

  await Promise.all(
    SHELVES.map(async (shelf) => {
      try {
        const res = await fetch(goodreadsRssUrl(userId, shelf), {
          headers: {
            "User-Agent":
              "ShelfPick/1.0 (personal bookshelf picker; +https://github.com/klinkedink/library_reader)",
            Accept: "application/rss+xml, application/xml, text/xml",
          },
        });
        if (!res.ok) {
          errors.push(`${shelf}: ${res.status}`);
          return;
        }
        const xml = await res.text();
        results.push({ shelf, books: parseGoodreadsRss(xml, shelf) });
      } catch {
        errors.push(`${shelf}: network`);
      }
    }),
  );

  const books = mergeRssShelves(results);
  if (books.length === 0) {
    return Response.json(
      {
        error: "empty",
        message:
          errors.length > 0
            ? "Could not read those public RSS feeds. Check that the profile is public, or upload a CSV instead."
            : "Those feeds were empty. Upload a Goodreads CSV for a full library.",
      },
      { status: 422 },
    );
  }

  return Response.json({
    userId,
    books,
    truncated: true,
    note: "Public RSS only includes about 100 books per shelf. A CSV export is more complete.",
  });
}
