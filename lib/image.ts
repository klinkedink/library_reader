export async function compressImageFile(file: File): Promise<{
  dataUrl: string;
  mediaType: string;
}> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    if (file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp") {
      const dataUrl = await fileToDataUrl(file);
      return { dataUrl, mediaType: file.type };
    }
    throw new Error(
      "Couldn't read that photo. Try JPEG or PNG, or take a new picture with your camera.",
    );
  }

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Couldn't prepare that photo.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  return { dataUrl, mediaType: "image/jpeg" };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function parseDataUrl(dataUrl: string): { mediaType: string; bytes: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Expected a compressed photo data URL.");
  }
  const bytes = Buffer.from(match[2], "base64");
  return { mediaType: match[1], bytes };
}
