"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { extractTileDataUrl, planPhotoTiles, prepareBookshelfPhoto } from "@/lib/image";
import { identifyTile } from "@/lib/identify-client";
import { rankShelf } from "@/lib/ranking";
import { dedupeDetected, newBookId } from "@/lib/shelf";
import {
  getTasteServerSnapshot,
  getTasteSnapshot,
  subscribeTaste,
  writeTaste,
} from "@/lib/taste-store";
import { TILE_CONCURRENCY, runPool } from "@/lib/tiles";
import type { BookMetadata, DetectedBook, RankingResult } from "@/lib/types";
import { LogoMark } from "./LogoMark";
import { PhotoStep } from "./PhotoStep";
import { PicksStep } from "./PicksStep";
import { TasteStep } from "./TasteStep";
import { StepPips } from "./Chrome";

type Step = "taste" | "photo" | "picks";

export function ShelfPickApp() {
  const taste = useSyncExternalStore(
    subscribeTaste,
    getTasteSnapshot,
    getTasteServerSnapshot,
  );
  const [step, setStep] = useState<Step>(taste ? "photo" : "taste");
  const [visionConfigured, setVisionConfigured] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [shelf, setShelf] = useState<DetectedBook[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [metadata, setMetadata] = useState<Record<string, BookMetadata>>({});
  const [rankingBusy, setRankingBusy] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [identifyFinished, setIdentifyFinished] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setVisionConfigured(Boolean(data.visionConfigured)))
      .catch(() => setVisionConfigured(false));
  }, []);

  function stopIdentify() {
    stopRef.current = true;
    abortRef.current?.abort();
  }

  async function onPickFile(file: File) {
    stopIdentify();
    const run = new AbortController();
    abortRef.current = run;
    stopRef.current = false;

    setLocalError(null);
    setRanking(null);
    setShelf([]);
    setIdentifyFinished(false);
    setProgress(null);

    try {
      const { source, previewDataUrl } = await prepareBookshelfPhoto(file);
      setPhotoDataUrl(previewDataUrl);

      const tiles = planPhotoTiles(source);
      console.info("[shelf-pick] tiles", {
        count: tiles.length,
        source: { width: source.width, height: source.height },
        tiles: tiles.map((tile) => ({
          row: tile.row,
          col: tile.col,
          w: tile.width,
          h: tile.height,
        })),
      });
      setIdentifying(true);
      setProgress({ done: 0, total: tiles.length });

      const collected: DetectedBook[] = [];
      let fatal: Error | null = null;
      let lastWarning: string | null = null;
      let finished = 0;

      await runPool(
        tiles,
        TILE_CONCURRENCY,
        async (tile) => {
          if (stopRef.current || fatal) return;
          try {
            const dataUrl = extractTileDataUrl(source, tile);
            const books = await identifyTile(dataUrl, run.signal);
            collected.push(...books);
            setShelf(dedupeDetected(collected));
          } catch (err) {
            if (run.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
              return;
            }
            const error = err as Error & { fatal?: boolean; status?: number; kind?: string };
            console.error("[shelf-pick] identify tile failed", {
              message: error.message,
              fatal: error.fatal,
              status: error.status,
              kind: error.kind,
            });
            if (error.fatal) {
              fatal = error;
              stopRef.current = true;
              run.abort();
              setLocalError(error.message);
              return;
            }
            lastWarning = error.message;
          } finally {
            finished += 1;
            setProgress({ done: finished, total: tiles.length });
          }
        },
        () => stopRef.current,
      );

      if (!fatal && collected.length === 0 && lastWarning) {
        setLocalError(lastWarning);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Couldn't use that photo.");
    } finally {
      setIdentifying(false);
      setIdentifyFinished(true);
    }
  }

  async function fetchMetadata(books: DetectedBook[]) {
    if (books.length === 0) return {} as Record<string, BookMetadata>;
    const res = await fetch("/api/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: books.map((b) => ({ id: b.id, title: b.title, author: b.author })),
      }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { metadata?: Record<string, BookMetadata> };
    return data.metadata ?? {};
  }

  async function onRank() {
    if (!taste) return;
    setRankingBusy(true);
    setLocalError(null);
    try {
      const meta = await fetchMetadata(shelf);
      setMetadata(meta);
      const withIsbn = shelf.map((book) => ({
        ...book,
        isbn: book.isbn || meta[book.id]?.isbn || null,
      }));
      const subjectMap: Record<string, string[]> = {};
      const popularityMap: Record<string, { averageRating: number | null; ratingsCount: number | null }> = {};
      for (const book of withIsbn) {
        const info = meta[book.id];
        subjectMap[book.id] = info?.subjects ?? [];
        popularityMap[book.id] = {
          averageRating: info?.averageRating ?? null,
          ratingsCount: info?.ratingsCount ?? null,
        };
      }
      setRanking(rankShelf(withIsbn, taste.books, subjectMap, popularityMap));
      setStep("picks");
    } catch {
      setLocalError("Could not finish ranking. Check the titles and try again.");
    } finally {
      setRankingBusy(false);
    }
  }

  function replaceTaste() {
    writeTaste(null);
    setStep("taste");
    setRanking(null);
  }

  const currentStep: Step = !taste ? "taste" : step === "taste" ? "photo" : step;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col px-4 pb-16 pt-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <LogoMark />
          <div>
            <p className="font-display text-2xl leading-none">Shelf Pick</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
              What&apos;s on this shelf for you
            </p>
          </div>
        </div>
      </header>
      <StepPips current={currentStep} />
      <div className="hairline my-5" />

      {currentStep === "taste" || !taste ? (
        <TasteStep
          onImported={(profile) => {
            writeTaste(profile);
            setStep("photo");
          }}
        />
      ) : null}

      {currentStep === "photo" && taste ? (
        <PhotoStep
          taste={taste}
          visionConfigured={visionConfigured}
          identifying={identifying}
          identifyFinished={identifyFinished}
          progress={progress}
          rankingBusy={rankingBusy}
          photoDataUrl={photoDataUrl}
          shelf={shelf}
          error={localError}
          onReplaceTaste={replaceTaste}
          onPickFile={onPickFile}
          onChangeBook={(id, patch) =>
            setShelf((current) => current.map((b) => (b.id === id ? { ...b, ...patch } : b)))
          }
          onRemoveBook={(id) => setShelf((current) => current.filter((b) => b.id !== id))}
          onAddBook={(title, author) =>
            setShelf((current) =>
              dedupeDetected([...current, { id: newBookId(), title, author, confidence: 1 }]),
            )
          }
          onRank={onRank}
          onStop={stopIdentify}
        />
      ) : null}

      {currentStep === "picks" && taste && ranking ? (
        <PicksStep
          taste={taste}
          result={ranking}
          metadata={metadata}
          onReplaceTaste={replaceTaste}
          onNewPhoto={() => {
            stopIdentify();
            setPhotoDataUrl(null);
            setShelf([]);
            setRanking(null);
            setIdentifyFinished(false);
            setProgress(null);
            setLocalError(null);
            setStep("photo");
          }}
          onBack={() => setStep("photo")}
        />
      ) : null}
    </div>
  );
}
