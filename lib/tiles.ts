export type TileRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
};

export const TILE_CONCURRENCY = 3;
export const MAX_TILES = 16;

/**
 * Interior plank rows, ignoring edge boards that are just the photo frame.
 */
export function uniqueInteriorPlanks(plankYs: number[], height: number): number[] {
  const ys = [...plankYs].sort((a, b) => a - b);
  const unique: number[] = [];
  for (const y of ys) {
    if (y < height * 0.04 || y > height * 0.96) continue;
    if (unique.length === 0 || y - unique[unique.length - 1] >= height * 0.045) {
      unique.push(y);
    }
  }
  return unique;
}

/**
 * How many horizontal bands to cut. Never uses raw pixel height — a 4000px-tall
 * phone photo of a *single* shelf used to become ~10 strips that chopped
 * vertical spines into unreadable pieces.
 *
 * 1–2 shelf photos (typical 3:4 / 4:3 phone frame) → 1–2 tiles.
 * A tall closet, or a 3:4 closet with many detected planks → 4–12 bands.
 */
export function chooseBandCount(width: number, height: number, plankCount = 0): number {
  const aspect = height / Math.max(width, 1);

  if (plankCount >= 4) {
    return Math.min(12, Math.max(4, plankCount));
  }

  if (plankCount > 0) {
    return plankCount <= 2 ? plankCount : 2;
  }

  if (aspect <= 1.45) return 1;
  if (aspect < 2.2) return 2;
  return Math.min(12, Math.max(4, Math.round(aspect * 3)));
}

export function overlappingBands(
  width: number,
  height: number,
  count: number,
  overlap = 0.22,
): TileRect[] {
  const safeCount = Math.max(1, count);
  const step = height / safeCount;
  const extra = step * overlap;
  const bands: TileRect[] = [];

  for (let i = 0; i < safeCount; i += 1) {
    const rawTop = i * step;
    const rawBottom = (i + 1) * step;
    const y = Math.max(0, Math.floor(rawTop - (i === 0 ? 0 : extra / 2)));
    const yEnd = Math.min(height, Math.ceil(rawBottom + (i === safeCount - 1 ? 0 : extra / 2)));
    bands.push({
      x: 0,
      y,
      width,
      height: Math.max(1, yEnd - y),
      row: i,
      col: 0,
    });
  }

  return bands;
}

export function bandsFromPlanks(
  width: number,
  height: number,
  plankYs: number[],
  overlap = 0.18,
): TileRect[] | null {
  const ys = uniqueInteriorPlanks(plankYs, height);
  const cuts = [0, ...ys, height];
  const unique: number[] = [];
  for (const y of cuts) {
    if (unique.length === 0 || y - unique[unique.length - 1] >= height * 0.045) {
      unique.push(y);
    }
  }
  // Need a closet-like stack (4+ shelf gaps). 1–2 boards around a single
  // shelf must not split the spines into thin strips.
  if (unique.length < 5) return null;

  const bands: TileRect[] = [];
  for (let i = 0; i < unique.length - 1; i += 1) {
    const span = unique[i + 1] - unique[i];
    const pad = span * overlap;
    const y = Math.max(0, Math.floor(unique[i] - (i === 0 ? 0 : pad / 2)));
    const yEnd = Math.min(height, Math.ceil(unique[i + 1] + (i === unique.length - 2 ? 0 : pad / 2)));
    bands.push({
      x: 0,
      y,
      width,
      height: Math.max(1, yEnd - y),
      row: i,
      col: 0,
    });
  }

  if (bands.length < 4 || bands.length > 12) return null;
  return bands;
}

export function shouldSplitWide(
  width: number,
  height: number,
  bandCount: number,
): boolean {
  if (bandCount > 8) return false;
  const bandHeight = height / Math.max(bandCount, 1);
  return width >= 1800 && width / bandHeight >= 2.6 && bandCount * 2 <= MAX_TILES;
}

export function splitWideTiles(tiles: TileRect[]): TileRect[] {
  const out: TileRect[] = [];
  for (const tile of tiles) {
    if (tile.width < 1600) {
      out.push(tile);
      continue;
    }
    const overlap = Math.round(tile.width * 0.14);
    const mid = Math.round(tile.width / 2);
    out.push({
      ...tile,
      x: tile.x,
      width: mid + overlap,
      col: 0,
    });
    out.push({
      ...tile,
      x: tile.x + mid - overlap,
      width: tile.width - mid + overlap,
      col: 1,
    });
  }
  return out.slice(0, MAX_TILES);
}

export function smoothSeries(values: number[], radius = 2): number[] {
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i - radius; j <= i + radius; j += 1) {
      if (j < 0 || j >= values.length) continue;
      sum += values[j];
      n += 1;
    }
    return n ? sum / n : 0;
  });
}

export function rowStddevs(image: {
  width: number;
  height: number;
  data: ArrayLike<number>;
}): number[] {
  const { width, height, data } = image;
  const stds: number[] = [];
  const x0 = Math.floor(width * 0.08);
  const x1 = Math.ceil(width * 0.92);

  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    let count = 0;
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      sum += lum;
      count += 1;
    }
    const mean = count ? sum / count : 0;
    let varSum = 0;
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const d = lum - mean;
      varSum += d * d;
    }
    stds.push(count ? Math.sqrt(varSum / count) : 0);
  }

  return stds;
}

export function findPlankYs(stds: number[]): number[] {
  if (stds.length < 40) return [];
  const smoothed = smoothSeries(stds, Math.max(1, Math.round(stds.length / 160)));
  const sorted = [...smoothed].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const threshold = median * 0.62;
  const minGap = Math.max(12, Math.round(stds.length / 16));
  const planks: number[] = [];

  for (let y = 2; y < smoothed.length - 2; y += 1) {
    const v = smoothed[y];
    if (v > threshold) continue;
    if (v > smoothed[y - 1] || v > smoothed[y + 1]) continue;
    if (v > smoothed[y - 2] && v > smoothed[y + 2]) continue;
    const last = planks[planks.length - 1];
    if (last !== undefined && y - last < minGap) {
      if (smoothed[y] < smoothed[last]) planks[planks.length - 1] = y;
      continue;
    }
    planks.push(y);
  }

  return planks;
}

export function planTilesFromSize(
  width: number,
  height: number,
  rowStd?: number[],
): TileRect[] {
  const plankYs = rowStd && rowStd.length === height ? findPlankYs(rowStd) : [];
  const plankBands = bandsFromPlanks(width, height, plankYs);
  const bands =
    plankBands ??
    overlappingBands(width, height, chooseBandCount(width, height, uniqueInteriorPlanks(plankYs, height).length));
  if (shouldSplitWide(width, height, bands.length)) {
    return splitWideTiles(bands);
  }
  return bands.slice(0, MAX_TILES);
}

export function planTilesFromImageData(image: {
  width: number;
  height: number;
  data: ArrayLike<number>;
}): TileRect[] {
  const stds = rowStddevs(image);
  const analysisHeight = image.height;
  return planTilesFromSize(image.width, image.height, stds).map((tile) => ({
    ...tile,
    y: Math.max(0, Math.min(analysisHeight - 1, tile.y)),
  }));
}

export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  shouldStop?: () => boolean,
): Promise<void> {
  let cursor = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length));

  async function next(): Promise<void> {
    while (cursor < items.length) {
      if (shouldStop?.()) return;
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => next()));
}
