"use client";

import { useState } from "react";
import type { DetectedBook, TasteProfile } from "@/lib/types";
import { GhostButton, PrimaryButton, TasteChip } from "./Chrome";

export function PhotoStep({
  taste,
  visionConfigured,
  identifying,
  identifyFinished,
  progress,
  photoDataUrl,
  shelf,
  error,
  rankingBusy,
  onReplaceTaste,
  onPickFile,
  onChangeBook,
  onRemoveBook,
  onAddBook,
  onRank,
  onStop,
}: {
  taste: TasteProfile;
  visionConfigured: boolean;
  identifying: boolean;
  identifyFinished: boolean;
  progress: { done: number; total: number } | null;
  photoDataUrl: string | null;
  shelf: DetectedBook[];
  error: string | null;
  rankingBusy: boolean;
  onReplaceTaste: () => void;
  onPickFile: (file: File, fromCamera: boolean) => void;
  onChangeBook: (id: string, patch: Partial<DetectedBook>) => void;
  onRemoveBook: (id: string) => void;
  onAddBook: (title: string, author: string) => void;
  onRank: () => void;
  onStop: () => void;
}) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAuthor, setDraftAuthor] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  function addDraft() {
    if (!draftTitle.trim()) return;
    onAddBook(draftTitle.trim(), draftAuthor.trim());
    setDraftTitle("");
    setDraftAuthor("");
  }

  const emptyAfterRead =
    Boolean(photoDataUrl) && !identifying && identifyFinished && shelf.length === 0 && !error;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-wine">Step 2</p>
        <h1 className="font-display mt-1 text-[2rem] leading-tight">
          Photograph the closet in front of you
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          A whole bookcase is fine — eight or twelve shelves in a second-hand
          shop, or a single bay. We read it shelf by shelf and only rank what&apos;s
          in the frame.
        </p>
      </div>

      <TasteChip taste={taste} onReplace={onReplaceTaste} />

      {!visionConfigured ? (
        <div className="rounded-md border border-gold/40 bg-card px-3 py-3 text-sm leading-relaxed text-ink-soft">
          <p className="font-medium text-ink">Vision key not set</p>
          <p className="mt-1">
            Add <code className="rounded bg-paper-2 px-1">OPENAI_API_KEY</code> (or
            Google / Anthropic) to read spines automatically. You can still
            photograph the shelf and type titles by hand.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col items-center rounded-lg border border-rule bg-card p-5">
        {photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoDataUrl}
            alt="Bookshelf you photographed"
            className="mb-4 max-h-56 w-full rounded-sm object-cover"
          />
        ) : (
          <div className="mb-4 flex h-36 w-full items-center justify-center rounded-sm border border-dashed border-rule bg-paper/60 text-sm text-ink-soft">
            No photo yet — camera or upload.
          </div>
        )}

        <label className="shutter relative flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-full bg-wine text-card">
          <span className="font-display text-lg">Snap</span>
          <span className="text-[10px] uppercase tracking-[0.16em] opacity-80">
            Camera
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={identifying}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPickFile(file, true);
              e.target.value = "";
            }}
          />
        </label>

        <label className="mt-4 cursor-pointer text-sm text-wine underline decoration-gold underline-offset-4">
          Or upload a photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={identifying}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPickFile(file, false);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {identifying ? (
        <div className="flex items-center justify-between gap-3 text-sm text-ink-soft">
          <p>
            {progress
              ? `${
                  progress.total <= 2
                    ? `Reading this shelf (${progress.done}/${progress.total})`
                    : `Reading band ${Math.min(progress.total, progress.done + 1)} of ${progress.total}`
                }${
                  shelf.length ? ` — ${shelf.length} title${shelf.length === 1 ? "" : "s"} so far` : ""
                }`
              : "Preparing the photo…"}
          </p>
          <GhostButton onClick={onStop} className="min-h-9 px-3 text-xs">
            Stop
          </GhostButton>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-stamp/40 bg-card px-3 py-2 text-sm text-stamp">
          <p className="font-medium text-stamp">Identify failed</p>
          <p className="mt-1 leading-relaxed">{error}</p>
        </div>
      ) : null}

      <div>
        <div className="flex items-end justify-between gap-2">
          <h2 className="font-display text-xl">In the frame</h2>
          <p className="text-xs text-ink-soft">
            {shelf.length === 0
              ? identifying
                ? "Waiting on the first band…"
                : "Nothing detected yet"
              : `${shelf.length} title${shelf.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {emptyAfterRead ? (
          <p className="mt-2 text-sm text-ink-soft">
            Finished reading this photo and the model returned no titles. That is
            a miss, not a request for a closer shot — type a title you can see,
            or retry. A key or model failure would show an error above, not this
            empty list.
          </p>
        ) : null}

        <ul className="mt-3 space-y-2">
          {shelf.map((book) => {
            const unsure = book.confidence < 0.6;
            const isEditing = editing === book.id;
            return (
              <li
                key={book.id}
                className={`rounded-md border bg-card px-3 py-2 ${
                  unsure ? "border-gold" : "border-rule"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={book.title}
                      onChange={(e) => onChangeBook(book.id, { title: e.target.value })}
                      className="min-h-10 w-full rounded border border-rule bg-paper px-2 text-sm"
                      placeholder="Title"
                    />
                    <input
                      value={book.author}
                      onChange={(e) => onChangeBook(book.id, { author: e.target.value })}
                      className="min-h-10 w-full rounded border border-rule bg-paper px-2 text-sm"
                      placeholder="Author"
                    />
                    <button
                      type="button"
                      className="text-xs text-wine underline"
                      onClick={() => setEditing(null)}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => setEditing(book.id)}
                    >
                      <p className="font-medium leading-snug">{book.title}</p>
                      <p className="text-sm text-ink-soft">
                        {book.author || "Author unknown — tap to fix"}
                      </p>
                      {unsure ? (
                        <p className="mt-1 text-[11px] uppercase tracking-wider text-gold">
                          Uncertain — tap to confirm
                        </p>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveBook(book.id)}
                      className="text-xs text-ink-soft"
                      aria-label={`Remove ${book.title}`}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 rounded-md border border-dashed border-rule p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">
            Missed a spine?
          </p>
          <div className="mt-2 grid gap-2">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Title"
              className="min-h-11 rounded-md border border-rule bg-card px-3 text-sm"
            />
            <input
              value={draftAuthor}
              onChange={(e) => setDraftAuthor(e.target.value)}
              placeholder="Author"
              className="min-h-11 rounded-md border border-rule bg-card px-3 text-sm"
            />
            <GhostButton type="button" onClick={addDraft} disabled={!draftTitle.trim()}>
              Add to shelf
            </GhostButton>
          </div>
        </div>
      </div>

      <PrimaryButton onClick={onRank} disabled={identifying || rankingBusy || shelf.length === 0}>
        {rankingBusy ? "Ranking this shelf…" : "Rank this shelf"}
      </PrimaryButton>
    </section>
  );
}
