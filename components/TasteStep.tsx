"use client";

import { useState } from "react";
import { parseGoodreadsCsv } from "@/lib/csv";
import { writeTaste } from "@/lib/taste-store";
import { summarizeTaste } from "@/lib/taste";
import type { GoodreadsBook, TasteProfile } from "@/lib/types";
import { PrimaryButton } from "./Chrome";

export function TasteStep({
  onImported,
}: {
  onImported: (profile: TasteProfile) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rssUrl, setRssUrl] = useState("");
  const [preview, setPreview] = useState<TasteProfile | null>(null);

  async function importBooks(
    books: GoodreadsBook[],
    source: TasteProfile["source"],
    label: string,
  ) {
    const profile: TasteProfile = {
      source,
      importedAt: new Date().toISOString(),
      label,
      books,
    };
    writeTaste(profile);
    setPreview(profile);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const books = parseGoodreadsCsv(text);
      await importBooks(books, "csv", file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that CSV.");
    } finally {
      setBusy(false);
    }
  }

  async function onDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/sample-goodreads-demo.csv");
      const text = await res.text();
      const books = parseGoodreadsCsv(text);
      await importBooks(books, "csv", "Demo library (sample CSV, not a real account)");
    } catch {
      setError("Couldn't load the demo library.");
    } finally {
      setBusy(false);
    }
  }

  async function onRss() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goodreads-rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rssUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not read that Goodreads profile.");
      }
      await importBooks(data.books, "rss", rssUrl.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "RSS import failed.");
    } finally {
      setBusy(false);
    }
  }

  const summary = preview ? summarizeTaste(preview.books) : null;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-wine">Step 1</p>
        <h1 className="font-display mt-1 text-[2rem] leading-tight text-ink">
          What do you actually like to read?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Shelf Pick ranks the books <em>in front of you</em>, not a generic catalog.
          Your Goodreads history is the taste model — highly rated authors, the
          shelves you actually use, and titles you already finished.
        </p>
      </div>

      <div className="library-card rounded-lg border border-rule p-4">
        <h2 className="font-display text-xl">Upload your Goodreads export</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>On Goodreads, open My Books.</li>
          <li>Import and export → Export library.</li>
          <li>Goodreads emails a CSV. Upload that file here.</li>
        </ol>
        <label className="mt-4 flex min-h-12 cursor-pointer items-center justify-center rounded-md bg-wine text-sm font-semibold text-card">
          {busy ? "Reading library…" : "Choose CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          onClick={onDemo}
          disabled={busy}
          className="mt-3 w-full text-center text-sm text-wine underline decoration-gold underline-offset-4"
        >
          Or try the labeled demo library
        </button>
      </div>

      <details className="rounded-lg border border-dashed border-rule bg-card/50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">
          No CSV handy? Paste a public profile URL
        </summary>
        <p className="mt-2 text-sm text-ink-soft">
          This pulls the public read / currently-reading / to-read RSS feeds
          (~100 books per shelf). It is a lighter fallback, not a full library.
        </p>
        <input
          value={rssUrl}
          onChange={(e) => setRssUrl(e.target.value)}
          placeholder="https://www.goodreads.com/user/show/12345-name"
          className="mt-3 min-h-12 w-full rounded-md border border-rule bg-card px-3 text-sm outline-none ring-wine focus:ring-2"
        />
        <PrimaryButton className="mt-3" disabled={busy || !rssUrl.trim()} onClick={onRss}>
          Pull public shelves
        </PrimaryButton>
      </details>

      {error ? (
        <p className="rounded-md border border-stamp/40 bg-card px-3 py-2 text-sm text-stamp">
          {error}
        </p>
      ) : null}

      {summary && preview ? (
        <div className="rounded-lg border border-wine/20 bg-card p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-wine">Ready</p>
          <p className="mt-1 font-display text-2xl">
            {summary.bookCount} books · {summary.ratedCount} rated
          </p>
          {summary.favoriteAuthors.length > 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              You tend to love {summary.favoriteAuthors.map((a) => a.author).join(", ")}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              Ratings are sparse. Ranking will lean on to-read and authors you have logged.
            </p>
          )}
          {preview.source === "rss" ? (
            <p className="mt-2 text-xs text-ink-soft">
              RSS is capped per shelf. A CSV export will rank more accurately.
            </p>
          ) : null}
          <PrimaryButton className="mt-4" onClick={() => onImported(preview)}>
            Continue to the camera
          </PrimaryButton>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">
          Nothing is uploaded to a server for taste — the library stays in this
          browser. Photograph a shelf next.
        </p>
      )}
    </section>
  );
}
