import type { TasteProfile } from "./types";

const KEY = "shelf-pick.taste.v1";

export function loadTaste(): TasteProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TasteProfile;
    if (!parsed?.books || !Array.isArray(parsed.books)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTaste(profile: TasteProfile): void {
  window.localStorage.setItem(KEY, JSON.stringify(profile));
}

export function clearTaste(): void {
  window.localStorage.removeItem(KEY);
}
