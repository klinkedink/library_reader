# Shelf Pick

Photograph a bookshelf. Rank the books that are actually in front of you — a store bay, a friend's living room, a library stack — using your Goodreads reading taste.

This is a personal picker, not a "people who bought this also bought" engine. The photo is the inventory. Goodreads is the taste model.

## What it does

1. **Taste** — Upload your official Goodreads library CSV (or, as a lighter fallback, paste a public Goodreads profile URL).
2. **Photo** — Take a picture of a real shelf on your phone, or upload one. A vision model reads titles and authors from spines. You can fix misses before ranking.
3. **Picks** — Get 3–7 books *on that shelf* that fit how you actually read, with a short specific reason. Titles you already logged as read are marked read, not recommended.

Taste lives in `localStorage` in your browser. It is not uploaded except the CSV parse (client-side) and the optional public RSS fetch.

## Run locally

```bash
npm install
cp .env.example .env.local
# add a vision key, see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On a phone, use the camera button; on desktop, upload a bookshelf photo.

```bash
npm test
npm run build
```

## Environment variables

Spine reading needs **one** vision-capable provider. If none is set, the app still runs: you will see a setup note and can type titles by hand.

| Variable | Used for |
| --- | --- |
| `OPENAI_API_KEY` | Primary. GPT-4o reads spines (best default). |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Used if OpenAI is unset. Gemini 2.5 Flash. |
| `ANTHROPIC_API_KEY` | Used if the two above are unset. Claude Sonnet. |
| `VISION_MODEL` | Optional override of the default model id for whichever provider is selected. |

Priority is OpenAI → Google → Anthropic. Covers come from Open Library (then Google Books); no extra key required.

Create `.env.local`:

```
OPENAI_API_KEY=sk-...
```

Restart `npm run dev` after changing env vars.

## Export your Goodreads CSV

Goodreads retired its developer API. Shelf Pick does **not** call it.

1. Sign in at [goodreads.com](https://www.goodreads.com).
2. Go to **My Books**.
3. On the left, **Import and export**.
4. Click **Export Library**.
5. Goodreads emails a CSV (sometimes after a short delay).
6. Upload that file on the Taste step.

Columns used: Title, Author, ISBN, ISBN13, My Rating, Average Rating, Date Read, Date Added, Bookshelves, Exclusive Shelf, Book Id.

### Public RSS fallback

If you only have a public profile URL (`https://www.goodreads.com/user/show/12345-name`), Shelf Pick can pull the public `list_rss` feeds for `read`, `currently-reading`, and `to-read` (~100 items per shelf). Use CSV when you can; RSS is incomplete on purpose.

## Demo library

[`public/sample-goodreads-demo.csv`](public/sample-goodreads-demo.csv) is a **labeled sample** for local demo and tests. It is not anyone's real account. The Taste screen has a "try the labeled demo library" link.

## How ranking works

- Highly rated authors are a strong match for unread books on the photographed shelf.
- Books on your Goodreads **to-read** list that appear on the shelf are called out as already queued.
- Exclusive shelf `read` (or a Date Read) → **already read**, never a pick.
- Currently-reading stays marked, not recommended.
- User shelves on 4–5★ books (and Open Library subjects, when available) add a secondary genre signal.
- Reasons are generated from those signals ("You rated 2 books by Kazuo Ishiguro 5.0★…"), not generic fluff.

## Deploy on Vercel

This is a single Next.js app. Import the GitHub repo in Vercel, set at least one vision key in project environment variables, and deploy.

## Privacy

- Taste profile: browser `localStorage` only.
- Photos: sent to your chosen vision provider to read spines, then discarded (not stored by this app).
- Cover lookups: Open Library / Google Books with title + author.

## Stack

Next.js (App Router), TypeScript, Vercel AI SDK, Vitest.
