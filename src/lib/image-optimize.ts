/**
 * Client-side cover image optimization.
 * Resizes the longest side to 1200px, compresses to 300–500KB,
 * prefers WebP output with JPEG fallback at 80–85% quality.
 */

const MAX_DIMENSION = 1200;
const TARGET_MIN_BYTES = 300 * 1024;
const TARGET_MAX_BYTES = 500 * 1024;
const HARD_MAX_BYTES = 600 * 1024;

function supportsWebP(): boolean {
  const canvas = document.createElement("canvas");
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

function drawToSize(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height / width) * MAX_DIMENSION);
        width = MAX_DIMENSION;
      } else if (height >= width && height > MAX_DIMENSION) {
        width = Math.round((width / height) * MAX_DIMENSION);
        height = MAX_DIMENSION;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(img.src);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Failed to encode ${type}`))),
      type,
      quality
    );
  });
}

/**
 * Optimize an image File for upload.
 * Returns a Blob ready for storage upload.
 */
export async function optimizeCoverImage(file: File): Promise<Blob> {
  const canvas = await drawToSize(file);
  const useWebP = supportsWebP();

  const candidates: { type: string; quality: number }[] = useWebP
    ? [
        { type: "image/webp", quality: 0.85 },
        { type: "image/webp", quality: 0.8 },
        { type: "image/webp", quality: 0.72 },
        { type: "image/jpeg", quality: 0.85 },
        { type: "image/jpeg", quality: 0.8 },
      ]
    : [
        { type: "image/jpeg", quality: 0.85 },
        { type: "image/jpeg", quality: 0.8 },
        { type: "image/jpeg", quality: 0.72 },
      ];

  let best: Blob | null = null;

  for (const { type, quality } of candidates) {
    const blob = await canvasToBlob(canvas, type, quality);
    if (blob.size <= TARGET_MAX_BYTES) {
      best = blob;
      break;
    }
    if (!best || blob.size < best.size) {
      best = blob;
    }
  }

  if (!best) throw new Error("Image optimization failed");
  if (best.size > HARD_MAX_BYTES) {
    // last resort: aggressive JPEG
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.6);
    best = blob;
  }

  return best;
}

/** File extension for the optimized blob's format. */
export function optimizedExtension(blob: Blob): string {
  return blob.type === "image/webp" ? "webp" : "jpg";
}
