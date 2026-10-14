// Passport proportions, 35 x 45 mm, as the ID card front prints them.
export const PHOTO_WIDTH = 420;
export const PHOTO_HEIGHT = 540;

export type CropRect = { sx: number; sy: number; sw: number; sh: number };

export function centerCrop(width: number, height: number): CropRect {
  if (width * PHOTO_HEIGHT > height * PHOTO_WIDTH) {
    const sw = Math.round((height * PHOTO_WIDTH) / PHOTO_HEIGHT);
    return { sx: Math.floor((width - sw) / 2), sy: 0, sw, sh: height };
  }
  const sh = Math.round((width * PHOTO_HEIGHT) / PHOTO_WIDTH);
  return { sx: 0, sy: Math.floor((height - sh) / 2), sw: width, sh };
}

export function pdfFilename(contentDisposition: string | undefined, fallback: string): string {
  const name = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1]?.trim();
  return name || fallback;
}
