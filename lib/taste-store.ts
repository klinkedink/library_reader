import type { TasteProfile } from "./types";
import { clearTaste, loadTaste, saveTaste } from "./storage";

let cache: TasteProfile | null | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeTaste(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getTasteSnapshot(): TasteProfile | null {
  if (typeof window === "undefined") return null;
  if (cache === undefined) cache = loadTaste();
  return cache;
}

export function getTasteServerSnapshot(): TasteProfile | null {
  return null;
}

export function writeTaste(profile: TasteProfile | null) {
  cache = profile;
  if (typeof window !== "undefined") {
    if (profile) saveTaste(profile);
    else clearTaste();
  }
  emit();
}
