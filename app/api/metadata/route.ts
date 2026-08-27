import { lookupBookMetadata } from "@/lib/metadata";

export async function POST(req: Request) {
  let body: { books?: { id: string; title: string; author: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const books = (body.books ?? []).slice(0, 24);
  const entries: [string, Awaited<ReturnType<typeof lookupBookMetadata>>][] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, books.length) }, async () => {
    while (cursor < books.length) {
      const index = cursor;
      cursor += 1;
      const book = books[index];
      const meta = await lookupBookMetadata(book.title, book.author);
      entries[index] = [book.id, meta];
    }
  });
  await Promise.all(workers);

  return Response.json({ metadata: Object.fromEntries(entries.filter(Boolean)) });
}
