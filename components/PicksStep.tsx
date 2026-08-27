"use client";

import type { BookMetadata, RankingResult, TasteProfile } from "@/lib/types";
import { goodreadsBookUrl, goodreadsSearchUrl } from "@/lib/metadata";
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
  return (
    <section className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-wine">Step 3</p>
        <h1 className="font-display mt-1 text-[2rem] leading-tight">
          From this shelf, for you
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Ranked against your Goodreads taste. Already-read titles stay on the
          checklist, not in the picks.
        </p>
      </div>

      <TasteChip taste={taste} onReplace={onReplaceTaste} />

      {result.picks.length === 0 ? (
        <div className="library-card rounded-lg border border-rule p-4">
          <p className="font-display text-2xl">No strong match on this shelf</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            None of these spines line up with authors you rate highly or books
            you already queued. Confirm any missed titles — a spelling fix is
            often enough — or try a tighter photo of one bay.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {result.picks.map((pick, index) => {
            const meta = metadata[pick.book.id];
            const gr = pick.matchedLibrary?.goodreadsId
              ? goodreadsBookUrl(pick.matchedLibrary.goodreadsId)
              : goodreadsSearchUrl(pick.book.title, pick.book.author);
            return (
              <li
                key={pick.book.id}
                className="library-card relative overflow-hidden rounded-lg border border-rule p-4"
              >
                <div className="flex gap-3">
                  <Cover
                    title={pick.book.title}
                    author={pick.book.author}
                    coverUrl={meta?.coverUrl}
                    className="h-28 w-20 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-[11px] tracking-[0.2em] text-wine">
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      {pick.kind === "queued" ? (
                        <span className="stamp px-2 py-0.5 text-[9px]">Queued</span>
                      ) : (
                        <span className="stamp px-2 py-0.5 text-[9px]">Pick</span>
                      )}
                    </div>
                    <h2 className="font-display mt-1 text-xl leading-tight">
                      {pick.book.title}
                    </h2>
                    <p className="text-sm text-ink-soft">{pick.book.author || "Unknown author"}</p>
                    <p className="mt-3 text-sm leading-relaxed text-ink">
                      {pick.reasons[0]}
                    </p>
                    {pick.reasons[1] ? (
                      <p className="mt-1 text-sm text-ink-soft">{pick.reasons[1]}</p>
                    ) : null}
                    <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <a href={gr} target="_blank" rel="noreferrer" className="text-wine underline">
                        Goodreads
                      </a>
                      {meta?.openLibraryUrl ? (
                        <a
                          href={meta.openLibraryUrl}
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
              </li>
            );
          })}
        </ol>
      )}

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
