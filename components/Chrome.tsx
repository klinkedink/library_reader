"use client";

import type { ButtonHTMLAttributes } from "react";
import type { TasteProfile } from "@/lib/types";
import { summarizeTaste } from "@/lib/taste";

export function TasteChip({
  taste,
  onReplace,
}: {
  taste: TasteProfile;
  onReplace: () => void;
}) {
  const summary = summarizeTaste(taste.books);
  const authors = summary.favoriteAuthors.map((a) => a.author).slice(0, 2).join(", ");

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-rule bg-card/80 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.14em] text-wine">Saved taste</p>
        <p className="truncate text-sm text-ink">
          {summary.bookCount} books
          {authors ? ` · ${authors}` : ""}
        </p>
        <p className="truncate text-xs text-ink-soft">{taste.label}</p>
      </div>
      <button
        type="button"
        onClick={onReplace}
        className="shrink-0 text-xs font-medium text-wine underline decoration-gold underline-offset-4"
      >
        Replace
      </button>
    </div>
  );
}

export function StepPips({ current }: { current: "taste" | "photo" | "picks" }) {
  const steps = [
    { id: "taste", label: "Taste" },
    { id: "photo", label: "Photo" },
    { id: "picks", label: "Picks" },
  ] as const;
  const idx = steps.findIndex((s) => s.id === current);

  return (
    <ol className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
      {steps.map((step, i) => (
        <li key={step.id} className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
              i <= idx
                ? "border-wine bg-wine text-card"
                : "border-rule bg-transparent text-ink-soft"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === idx ? "text-ink" : ""}>{step.label}</span>
          {i < steps.length - 1 ? <span className="w-6 border-t border-dashed border-rule" /> : null}
        </li>
      ))}
    </ol>
  );
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-md bg-wine px-4 text-sm font-semibold tracking-wide text-card transition enabled:hover:bg-wine-dark disabled:opacity-50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center rounded-md border border-rule bg-card/60 px-4 text-sm text-ink enabled:hover:border-wine ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
