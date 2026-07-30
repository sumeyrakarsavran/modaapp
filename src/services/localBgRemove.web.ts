/**
 * Tarayıcı-içi ÜCRETSİZ arka plan silme — web.
 * @imgly/background-removal: WASM/ONNX modeli ilk kullanımda indirilir (~40MB),
 * sonrası tarayıcı önbelleğinden çalışır. Anahtar gerektirmez.
 */

export async function removeBackgroundLocal(imageUri: string): Promise<string | null> {
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const blob = await removeBackground(imageUri, {
      output: { format: 'image/png', quality: 0.9 },
    });
    return await blobToDataUri(blob, 700);
  } catch {
    return null;
  }
}

/** Blob'u en fazla maxDim piksele küçültüp PNG data URI'ye çevirir (şeffaflık korunur). */
async function blobToDataUri(blob: Blob, maxDim: number): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas yok');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/png');
}
