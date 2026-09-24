/**
 * Dynamic Artwork Color Extraction Engine for MyMusicApp.
 * Lightweight, local-only, deterministic image downsampling algorithm.
 */

export interface ExtractedArtworkPalette {
  readonly primary: string;
  readonly secondary: string;
  readonly muted: string;
  readonly contrast: string;
  readonly glow: string;
  readonly gradient: string;
}

const PALETTE_CACHE = new Map<string, ExtractedArtworkPalette>();
const MAX_CACHE_SIZE = 100;

/**
 * Converts RGB components to Hex string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculates relative luminance for WCAG contrast determination.
 */
function calculateLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

/**
 * Extracts a 6-token semantic color palette from RGBA image pixel data.
 */
export function extractPaletteFromImageData(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): ExtractedArtworkPalette | null {
  if (!data || data.length === 0 || width <= 0 || height <= 0) {
    return null;
  }

  const buckets: Array<{ r: number; g: number; b: number; count: number; sat: number }> = Array.from(
    { length: 12 },
    () => ({ r: 0, g: 0, b: 0, count: 0, sat: 0 })
  );

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let validPixels = 0;

  const pixelCount = Math.floor(data.length / 4);

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    const a = data[idx + 3]!;

    // Ignore transparent or extreme pixels
    if (a < 128) continue;
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const diff = maxVal - minVal;

    // Filter extreme monochrome blacks/whites from primary selection
    if (maxVal < 15 || minVal > 240) continue;

    totalR += r;
    totalG += g;
    totalB += b;
    validPixels++;

    // Calculate approximate hue bin (0..11)
    let hue = 0;
    if (diff > 0) {
      if (maxVal === r) {
        hue = ((g - b) / diff) % 6;
      } else if (maxVal === g) {
        hue = (b - r) / diff + 2;
      } else {
        hue = (r - g) / diff + 4;
      }
      hue = Math.round(hue * 60);
      if (hue < 0) hue += 360;
    }

    const binIndex = Math.floor(hue / 30) % 12;
    const bucket = buckets[binIndex]!;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.sat += diff;
    bucket.count++;
  }

  // Sort buckets by pixel density weighted by saturation
  const sorted = buckets
    .filter(b => b.count > 0)
    .sort((a, b) => (b.count * (b.sat + 1)) - (a.count * (a.sat + 1)));

  let primaryR = 139;
  let primaryG = 92;
  let primaryB = 246;

  let secR = 56;
  let secG = 189;
  let secB = 248;

  if (sorted.length > 0 && sorted[0]) {
    primaryR = Math.round(sorted[0].r / sorted[0].count);
    primaryG = Math.round(sorted[0].g / sorted[0].count);
    primaryB = Math.round(sorted[0].b / sorted[0].count);
  } else if (validPixels > 0) {
    primaryR = Math.round(totalR / validPixels);
    primaryG = Math.round(totalG / validPixels);
    primaryB = Math.round(totalB / validPixels);
  }

  if (sorted.length > 1 && sorted[1]) {
    secR = Math.round(sorted[1].r / sorted[1].count);
    secG = Math.round(sorted[1].g / sorted[1].count);
    secB = Math.round(sorted[1].b / sorted[1].count);
  } else {
    // Derive complementary secondary
    secR = Math.min(255, primaryG + 40);
    secG = Math.min(255, primaryB + 40);
    secB = Math.min(255, primaryR + 40);
  }

  const primaryHex = rgbToHex(primaryR, primaryG, primaryB);
  const secondaryHex = rgbToHex(secR, secG, secB);
  const glowHex = rgbToHex(
    Math.min(255, primaryR + 30),
    Math.min(255, primaryG + 30),
    Math.min(255, primaryB + 30)
  );
  const lum = calculateLuminance(primaryR, primaryG, primaryB);
  const contrastHex = lum < 0.5 ? '#ffffff' : '#0f172a';
  const mutedHex = `rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.25)`;
  const gradientStr = `linear-gradient(135deg, ${primaryHex} 0%, ${secondaryHex} 100%)`;

  return {
    primary: primaryHex,
    secondary: secondaryHex,
    muted: mutedHex,
    contrast: contrastHex,
    glow: glowHex,
    gradient: gradientStr
  };
}

/**
 * Extracts a palette asynchronously from an image source URL or Blob URL.
 * Uses LRU cache to prevent re-extracting identical artwork.
 */
export async function extractPaletteFromImage(
  imageSrc: string | null | undefined,
  cacheKey?: string
): Promise<ExtractedArtworkPalette | null> {
  if (!imageSrc) return null;

  const key = cacheKey || imageSrc;
  if (PALETTE_CACHE.has(key)) {
    return PALETTE_CACHE.get(key)!;
  }

  return new Promise(resolve => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        if (typeof document === 'undefined') {
          resolve(null);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32);
        const palette = extractPaletteFromImageData(imgData.data, 32, 32);

        if (palette) {
          if (PALETTE_CACHE.size >= MAX_CACHE_SIZE) {
            const firstKey = PALETTE_CACHE.keys().next().value;
            if (firstKey) PALETTE_CACHE.delete(firstKey);
          }
          PALETTE_CACHE.set(key, palette);
        }

        resolve(palette);
      } catch (_err) {
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = imageSrc;
  });
}

/**
 * Clears the extraction LRU cache.
 */
export function clearPaletteCache(): void {
  PALETTE_CACHE.clear();
}
