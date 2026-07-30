/**
 * İşlemeden önce fotoğrafı makul bir boyuta küçültür.
 *
 * Neden gerekli: telefon kameraları 12MP+ (ör. 4000×3000) foto üretir. Bu
 * ham fotoğrafı arka plan silme + görsel sınıflandırma + PNG piksel çözümü
 * gibi ağır adımlardan geçirmek onlarca MB bellek ayırır; düşük/orta bellekli
 * cihazlarda işletim sistemi uygulamayı öldürür ("uygulamadan atıyor").
 * ~1200px'e küçültmek belleği ~10 kat azaltır ve çökmeyi engeller.
 */

export async function resizeForProcessing(
  uri: string,
  originalW?: number,
  originalH?: number,
  maxDim = 1200,
): Promise<string> {
  try {
    // Zaten küçükse hiç dokunma (gereksiz bellek/işlem yok)
    if (originalW && originalH && Math.max(originalW, originalH) <= maxDim) {
      return uri;
    }

    const Manip = await import('expo-image-manipulator');

    // SDK 57 bağlam tabanlı API
    const anyManip = Manip as any;
    if (anyManip.ImageManipulator?.manipulate) {
      const targetW =
        originalW && originalH
          ? Math.round((maxDim / Math.max(originalW, originalH)) * originalW)
          : maxDim;
      const ctx = anyManip.ImageManipulator.manipulate(uri).resize({ width: targetW });
      const rendered = await ctx.renderAsync();
      const out = await rendered.saveAsync({
        compress: 0.85,
        format: anyManip.SaveFormat?.JPEG ?? 'jpeg',
      });
      return out.uri ?? uri;
    }

    // Eski API (manipulateAsync) — yedek
    if (anyManip.manipulateAsync) {
      const out = await anyManip.manipulateAsync(uri, [{ resize: { width: maxDim } }], {
        compress: 0.85,
        format: anyManip.SaveFormat?.JPEG ?? 'jpeg',
      });
      return out.uri ?? uri;
    }

    return uri;
  } catch {
    // Küçültme başarısızsa orijinali kullan (akış bozulmasın)
    return uri;
  }
}
