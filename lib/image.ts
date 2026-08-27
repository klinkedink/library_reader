import {
  planTilesFromImageData,
  planTilesFromSize,
  type TileRect,
} from "./tiles";

export const WORKING_MAX_SIDE = 5120;
export const PREVIEW_MAX_SIDE = 1400;
export const TILE_MAX_LONG_SIDE = 3072;
export const TILE_JPEG_QUALITY = 0.9;
export const IDENTIFY_MAX_DATA_URL_CHARS = 6_500_000;

export function scaleToLongSide(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxSide) return { width, height };
  const scale = maxSide / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawToCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxSide: number,
): HTMLCanvasElement {
  const { width, height } = scaleToLongSide(sourceWidth, sourceHeight, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare that photo.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export async function prepareBookshelfPhoto(file: File): Promise<{
  previewDataUrl: string;
  source: HTMLCanvasElement;
}> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error(
      "Couldn't read that photo. Try JPEG or PNG, or take a new picture with your camera.",
    );
  }

  try {
    const source = drawToCanvas(bitmap, bitmap.width, bitmap.height, WORKING_MAX_SIDE);
    const preview =
      Math.max(source.width, source.height) > PREVIEW_MAX_SIDE
        ? drawToCanvas(source, source.width, source.height, PREVIEW_MAX_SIDE)
        : source;
    return {
      source,
      previewDataUrl: preview.toDataURL("image/jpeg", 0.82),
    };
  } finally {
    bitmap.close();
  }
}

export function planPhotoTiles(source: HTMLCanvasElement): TileRect[] {
  const analysisWidth = 180;
  const analysisHeight = Math.max(
    40,
    Math.round(source.height * (analysisWidth / source.width)),
  );
  const analysis = document.createElement("canvas");
  analysis.width = analysisWidth;
  analysis.height = analysisHeight;
  const ctx = analysis.getContext("2d");
  if (!ctx) return planTilesFromSize(source.width, source.height);

  ctx.drawImage(source, 0, 0, analysisWidth, analysisHeight);
  const imageData = ctx.getImageData(0, 0, analysisWidth, analysisHeight);
  const analysisTiles = planTilesFromImageData(imageData);
  const scaleX = source.width / analysisWidth;
  const scaleY = source.height / analysisHeight;

  return analysisTiles.map((tile) => {
    const x = Math.max(0, Math.round(tile.x * scaleX));
    const y = Math.max(0, Math.round(tile.y * scaleY));
    return {
      row: tile.row,
      col: tile.col,
      x,
      y,
      width: Math.max(1, Math.min(source.width - x, Math.round(tile.width * scaleX))),
      height: Math.max(1, Math.min(source.height - y, Math.round(tile.height * scaleY))),
    };
  });
}

export function extractTileDataUrl(
  source: HTMLCanvasElement,
  tile: TileRect,
): string {
  const sx = Math.max(0, Math.min(source.width - 1, tile.x));
  const sy = Math.max(0, Math.min(source.height - 1, tile.y));
  const sw = Math.max(1, Math.min(source.width - sx, tile.width));
  const sh = Math.max(1, Math.min(source.height - sy, tile.height));
  const { width, height } = scaleToLongSide(sw, sh, TILE_MAX_LONG_SIDE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't slice that shelf band.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);

  for (const quality of [TILE_JPEG_QUALITY, 0.88]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= IDENTIFY_MAX_DATA_URL_CHARS) return dataUrl;
  }

  throw new Error("A shelf slice was still too large to send. Try a tighter photo.");
}

export function parseDataUrl(dataUrl: string): { mediaType: string; bytes: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Expected a compressed photo data URL.");
  }
  const bytes = Buffer.from(match[2], "base64");
  return { mediaType: match[1], bytes };
}
