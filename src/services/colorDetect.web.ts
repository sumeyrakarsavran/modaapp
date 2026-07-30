/**
 * Fotoğraftan baskın renk tespiti — web (canvas piksel analizi, ücretsiz).
 * Ortak algoritma: şeffaf pikseller (silinen arka plan) yok sayılır,
 * yüksek renk çeşitliliği "desenli" olarak işaretlenir.
 */

import { colorIdFromPixels } from '@/services/autotag';

export async function detectPhotoColor(imageUri: string): Promise<string | null> {
  try {
    const img = await loadImage(imageUri);
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    return colorIdFromPixels(data, 4);
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Geliştirme modunda konsoldan test edebilmek için
if (typeof window !== 'undefined' && (globalThis as any).__DEV__) {
  (window as any).__testColor = detectPhotoColor;
}
