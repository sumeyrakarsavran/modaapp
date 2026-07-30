/**
 * Fotoğraf küçültme yardımcıları.
 *
 * Neden gerekli: telefon kameraları 12MP+ (ör. 4000×3000) foto üretir. Bu
 * ham fotoğrafı arka plan silme + görsel sınıflandırma + PNG piksel çözümü
 * gibi ağır adımlardan geçirmek onlarca MB bellek ayırır; düşük/orta bellekli
 * cihazlarda işletim sistemi uygulamayı öldürür ("uygulamadan atıyor").
 */

type Format = 'jpeg' | 'png';

async function resizeTo(uri: string, targetWidth: number, format: Format): Promise<string> {
  const Manip = await import('expo-image-manipulator');
  const anyManip = Manip as any;
  const saveFormat =
    format === 'png' ? (anyManip.SaveFormat?.PNG ?? 'png') : (anyManip.SaveFormat?.JPEG ?? 'jpeg');
  // PNG'de sıkıştırma oranı kalite kaybı yapmaz; JPEG'de makul bir değer
  const compress = format === 'png' ? 1 : 0.85;

  // SDK 57 bağlam tabanlı API
  if (anyManip.ImageManipulator?.manipulate) {
    const ctx = anyManip.ImageManipulator.manipulate(uri).resize({ width: targetWidth });
    const rendered = await ctx.renderAsync();
    const out = await rendered.saveAsync({ compress, format: saveFormat });
    return out?.uri ?? uri;
  }

  // Eski API (manipulateAsync) — yedek
  if (anyManip.manipulateAsync) {
    const out = await anyManip.manipulateAsync(uri, [{ resize: { width: targetWidth } }], {
      compress,
      format: saveFormat,
    });
    return out?.uri ?? uri;
  }

  return uri;
}

/** Kaydedilecek/işlenecek ana kopya — ~1200px JPEG. */
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
    const targetW =
      originalW && originalH
        ? Math.max(1, Math.round((maxDim / Math.max(originalW, originalH)) * originalW))
        : maxDim;
    return await resizeTo(uri, targetW, 'jpeg');
  } catch {
    // Küçültme başarısızsa orijinali kullan (akış bozulmasın)
    return uri;
  }
}

/**
 * Analiz (renk + sınıflandırma) için küçük kopya — ~256px PNG.
 *
 * PNG şart: arka planı silinmiş fotoğrafın ŞEFFAFLIĞI korunmalı, yoksa
 * renk analizi silinen arka planı da sayar. 256px'te piksel çözümü ~260KB
 * bellek kullanır (1200px'te ~5.7MB idi) — çökme riski biter.
 */
export async function resizeForAnalysis(uri: string, maxDim = 256): Promise<string> {
  try {
    return await resizeTo(uri, maxDim, 'png');
  } catch {
    return uri;
  }
}
