"use client";

import type { BookMetadata, RankedShelfBook, RankingResult, TasteProfile } from "@/lib/types";
import { goodreadsBookUrl, goodreadsSearchUrl } from "@/lib/metadata";
import { popularityReason } from "@/lib/popularity";
import { Cover } from "./Cover";
import { GhostButton, PrimaryButton, TasteChip } from "./Chrome";

export function PicksStep({
  taste,
  result,
  metadata,
  onReplaceTaste,
  onNewPhoto,
  onBack,
}: {
  taste: TasteProfile;
  result: RankingResult;
  metadata: Record<string, BookMetadata>;
  onReplaceTaste: () => void;
  onNewPhoto: () => void;
  onBack: () => void;
}) {
  const basedOn =
    result.ratedCount > 0 && result.ratedCount !== result.tasteBookCount
      ? `Based on ${result.tasteBookCount} books (${result.ratedCount} rated)`
      : `Based on ${result.tasteBookCount} books`;

  return (
    <section className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-wine">Step 3</p>
        <h1 className="font-display mt-1 text-[2rem] leading-tight">
          From this shelf, for you
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          The photo is still the inventory. Personal picks use your Goodreads
          authors, subjects, and to-read list — {basedOn.toLowerCase()}.
          Already-read titles are not recommended.
        </p>
      </div>

      <TasteChip taste={taste} onReplace={onReplaceTaste} />

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl">For you</h2>
          <p className="text-sm text-ink-soft">{basedOn}</p>
        </div>
        {result.picks.length === 0 ? (
          <div className="library-card rounded-lg border border-rule p-4">
            <p className="font-display text-2xl">No strong personal match</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Nothing here lines up with authors you rate, subjects you read, or
              your to-read list ({basedOn.toLowerCase()}). Check most popular and
              genre below, or add a missed spine.
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {result.picks.map((pick, index) => (
              <li key={pick.book.id}>
                <PickCard
                  pick={pick}
                  metadata={metadata[pick.book.id]}
                  index={index + 1}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      {result.popular.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-2xl">Most popular on this shelf</h2>
            <p className="text-sm text-ink-soft">
              Public ratings for titles in the photo (Google Books, or Open
              Library when Google has none).
            </p>
          </div>
          <ol className="space-y-3">
            {result.popular.map((pick, index) => (
              <li key={`pop-${pick.book.id}`}>
                <PickCard
                  pick={pick}
                  metadata={metadata[pick.book.id]}
                  index={index + 1}
                  stamp="Popular"
                  extra={popularityReason({
                    averageRating: pick.averageRating,
                    ratingsCount: pick.ratingsCount,
                  })}
                />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {result.genres.length > 0 ? (
        <section className="space-y-5">
          <div>
            <h2 className="font-display text-2xl">By genre</h2>
            <p className="text-sm text-ink-soft">
              Genres that actually appear in this photo. Top 1–3 mix your taste
              with popularity.
            </p>
          </div>
          {result.genres.map((group) => (
            <div key={group.id} className="space-y-2">
              <h3 className="font-display text-lg">{group.label}</h3>
              <ol className="space-y-3">
                {group.books.map((pick) => (
                  <li key={`${group.id}-${pick.book.id}`}>
                    <PickCard
                      pick={pick}
                      metadata={metadata[pick.book.id]}
                      compact
                    />
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      ) : null}

      {result.alreadyRead.length > 0 ? (
        <section>
          <h2 className="font-display text-lg">Already read</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {result.alreadyRead.map((item) => (
              <li key={item.book.id} className="flex justify-between gap-2 border-b border-rule/70 py-2">
                <span>
                  {item.book.title}
                  {item.book.author ? ` · ${item.book.author}` : ""}
                </span>
                <span className="shrink-0 text-moss">Read</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.currentlyReading.length > 0 ? (
        <section>
          <h2 className="font-display text-lg">Currently reading</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {result.currentlyReading.map((item) => (
              <li key={item.book.id} className="py-1 text-ink-soft">
                {item.book.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-lg">Full shelf</h2>
        <ul className="mt-2 divide-y divide-rule/80 rounded-md border border-rule bg-card">
          {[...result.picks, ...result.currentlyReading, ...result.alreadyRead, ...result.rest].map(
            (item) => (
              <li key={`all-${item.book.id}`} className="flex items-center gap-3 px-3 py-2">
                <Cover
                  title={item.book.title}
                  author={item.book.author}
                  coverUrl={metadata[item.book.id]?.coverUrl}
                  className="h-12 w-8 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.book.title}</p>
                  <p className="truncate text-xs text-ink-soft">{item.book.author}</p>
                </div>
                <Status kind={item.kind} />
              </li>
            ),
          )}
        </ul>
      </section>

      <div className="grid gap-2">
        <PrimaryButton onClick={onNewPhoto}>Photograph another shelf</PrimaryButton>
        <GhostButton onClick={onBack}>Edit titles</GhostButton>
      </div>
    </section>
  );
}

function PickCard({
  pick,
  metadata,
  index,
  stamp,
  extra,
  compact = false,
}: {
  pick: RankedShelfBook;
  metadata?: BookMetadata;
  index?: number;
  stamp?: string;
  extra?: string | null;
  compact?: boolean;
}) {
  const gr = pick.matchedLibrary?.goodreadsId
    ? goodreadsBookUrl(pick.matchedLibrary.goodreadsId)
    : goodreadsSearchUrl(pick.book.title, pick.book.author);
  const label =
    stamp ??
    (pick.kind === "queued"
      ? "Queued"
      : pick.kind === "already-read"
        ? "Read"
        : pick.kind === "currently-reading"
          ? "Reading"
          : pick.kind === "pick"
            ? "Pick"
            : "On shelf");
  const reason = extra || pick.reasons[0];

  return (
    <article className="library-card relative overflow-hidden rounded-lg border border-rule p-4">
      <div className="flex gap-3">
        <Cover
          title={pick.book.title}
          author={pick.book.author}
          coverUrl={metadata?.coverUrl}
          className={compact ? "h-20 w-14 shrink-0" : "h-28 w-20 shrink-0"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {index ? (
              <p className="font-display text-[11px] tracking-[0.2em] text-wine">
                {String(index).padStart(2, "0")}
              </p>
            ) : (
              <span />
            )}
            <span className="stamp px-2 py-0.5 text-[9px]">{label}</span>
          </div>
          <h3 className={`font-display mt-1 leading-tight ${compact ? "text-lg" : "text-xl"}`}>
            {pick.book.title}
          </h3>
          <p className="text-sm text-ink-soft">{pick.book.author || "Unknown author"}</p>
          {reason ? (
            <p className="mt-3 text-sm leading-relaxed text-ink">{reason}</p>
          ) : null}
          {!extra && pick.reasons[1] ? (
            <p className="mt-1 text-sm text-ink-soft">{pick.reasons[1]}</p>
          ) : null}
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <a href={gr} target="_blank" rel="noreferrer" className="text-wine underline">
              Goodreads
            </a>
            {metadata?.openLibraryUrl ? (
              <a
                href={metadata.openLibraryUrl}
                target="_blank"
                rel="noreferrer"
                className="text-wine underline"
              >
                Open Library
              </a>
            ) : null}
          </p>
        </div>
      </div>
    </article>
  );
}

function Status({ kind }: { kind: RankingResult["picks"][number]["kind"] }) {
  const label =
    kind === "already-read"
      ? "Read"
      : kind === "currently-reading"
        ? "Reading"
        : kind === "queued"
          ? "To-read"
          : kind === "pick"
            ? "Pick"
            : "—";
  const color =
    kind === "already-read"
      ? "text-moss"
      : kind === "pick" || kind === "queued"
        ? "text-wine"
        : "text-ink-soft";
  return <span className={`text-[11px] uppercase tracking-wider ${color}`}>{label}</span>;
}
