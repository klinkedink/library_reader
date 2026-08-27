"use client";

import { useObject } from "@ai-sdk/react";
import { useMemo, useState, useSyncExternalStore, useEffect } from "react";
import { z } from "zod";
import { compressImageFile } from "@/lib/image";
import { rankShelf } from "@/lib/ranking";
import { dedupeDetected, newBookId } from "@/lib/shelf";
import {
  getTasteServerSnapshot,
  getTasteSnapshot,
  subscribeTaste,
  writeTaste,
} from "@/lib/taste-store";
import type { BookMetadata, DetectedBook, RankingResult } from "@/lib/types";
import { detectedSpineSchema } from "@/lib/vision";
import { LogoMark } from "./LogoMark";
import { PhotoStep } from "./PhotoStep";
import { PicksStep } from "./PicksStep";
import { TasteStep } from "./TasteStep";
import { StepPips } from "./Chrome";

type Step = "taste" | "photo" | "picks";

function spinesFromStream(
  object: Array<{ title?: string; author?: string; confidence?: number } | undefined> | undefined,
): DetectedBook[] {
  if (!object) return [];
  return dedupeDetected(
    object
      .filter((book): book is { title: string; author?: string; confidence?: number } =>
        Boolean(book?.title),
      )
      .map((book) => ({
        id: `${book.title}|${book.author ?? ""}`.toLowerCase(),
        title: book.title,
        author: book.author ?? "",
        confidence: book.confidence ?? 0.5,
      })),
  );
}

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
  const [liveStream, setLiveStream] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [metadata, setMetadata] = useState<Record<string, BookMetadata>>({});
  const [rankingBusy, setRankingBusy] = useState(false);

  const { object, submit, isLoading, error, stop, clear } = useObject({
    api: "/api/identify",
    schema: z.array(detectedSpineSchema),
    onFinish: (event) => {
      const next = spinesFromStream(event.object);
      if (next.length > 0) setShelf(next);
      setLiveStream(false);
    },
  });

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setVisionConfigured(Boolean(data.visionConfigured)))
      .catch(() => setVisionConfigured(false));
  }, []);

  const streamed = useMemo(() => spinesFromStream(object), [object]);
  const visibleShelf = liveStream ? streamed : shelf;

  const errorMessage = useMemo(() => {
    if (localError) return localError;
    if (!error) return null;
    const msg = error.message || "Could not read that photo.";
    if (msg.toLowerCase().includes("503") || msg.toLowerCase().includes("missing")) {
      return "No vision key is configured. Type the spines you can read, or add an API key and retry.";
    }
    return msg;
  }, [error, localError]);

  async function onPickFile(file: File) {
    setLocalError(null);
    setRanking(null);
    try {
      const { dataUrl } = await compressImageFile(file);
      setPhotoDataUrl(dataUrl);
      setShelf([]);
      setLiveStream(true);
      clear();
      if (!visionConfigured) {
        setLiveStream(false);
        setLocalError(
          "No vision model key on the server. Photograph is saved — add titles by hand, or set OPENAI_API_KEY.",
        );
        return;
      }
      submit({ image: dataUrl });
    } catch (err) {
      setLiveStream(false);
      setLocalError(err instanceof Error ? err.message : "Couldn't use that photo.");
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
      const meta = await fetchMetadata(visibleShelf);
      setMetadata(meta);
      const withIsbn = visibleShelf.map((book) => ({
        ...book,
        isbn: book.isbn || meta[book.id]?.isbn || null,
      }));
      const subjectMap: Record<string, string[]> = {};
      for (const book of withIsbn) {
        subjectMap[book.id] = meta[book.id]?.subjects ?? [];
      }
      setRanking(rankShelf(withIsbn, taste.books, subjectMap));
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
          identifying={isLoading}
          rankingBusy={rankingBusy}
          photoDataUrl={photoDataUrl}
          shelf={visibleShelf}
          error={errorMessage}
          onReplaceTaste={replaceTaste}
          onPickFile={onPickFile}
          onChangeBook={(id, patch) => {
            setLiveStream(false);
            setShelf((current) =>
              (current.length ? current : streamed).map((b) => (b.id === id ? { ...b, ...patch } : b)),
            );
          }}
          onRemoveBook={(id) => {
            setLiveStream(false);
            setShelf((current) => (current.length ? current : streamed).filter((b) => b.id !== id));
          }}
          onAddBook={(title, author) => {
            setLiveStream(false);
            setShelf((current) =>
              dedupeDetected([
                ...(current.length ? current : streamed),
                { id: newBookId(), title, author, confidence: 1 },
              ]),
            );
          }}
          onRank={onRank}
          onStop={stop}
        />
      ) : null}

      {currentStep === "picks" && taste && ranking ? (
        <PicksStep
          taste={taste}
          result={ranking}
          metadata={metadata}
          onReplaceTaste={replaceTaste}
          onNewPhoto={() => {
            setPhotoDataUrl(null);
            setShelf([]);
            setRanking(null);
            setLiveStream(false);
            clear();
            setStep("photo");
          }}
          onBack={() => setStep("photo")}
        />
      ) : null}
    </div>
  );
}
