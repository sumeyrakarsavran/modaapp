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

/**
 * Fotoğrafı istenen orana ORTADAN kırpar (uygulama içi kamera için).
 *
 * Sistem kırpma ekranı ayrı bir activity açtığı ve süreç ölümüne yol açtığı
 * için kırpmayı kendimiz yapıyoruz — kamera ekranındaki çerçeve rehberi ile
 * aynı mantık: hedef orandaki EN BÜYÜK ortalanmış dikdörtgen.
 */
export async function cropToAspect(
  uri: string,
  width: number,
  height: number,
  aspect: [number, number],
): Promise<{ uri: string; width?: number; height?: number }> {
  const original = { uri, width: width || undefined, height: height || undefined };
  try {
    if (!(width > 0) || !(height > 0)) return original;
    const target = aspect[0] / aspect[1];
    const current = width / height;
    let cw: number;
    let ch: number;
    if (current > target) {
      ch = height;
      cw = Math.round(height * target);
    } else {
      cw = width;
      ch = Math.round(width / target);
    }
    cw = Math.max(1, Math.min(cw, width));
    ch = Math.max(1, Math.min(ch, height));
    const originX = Math.max(0, Math.round((width - cw) / 2));
    const originY = Math.max(0, Math.round((height - ch) / 2));
    // Zaten hedef orandaysa dokunma
    if (cw === width && ch === height) return original;

    const Manip = await import('expo-image-manipulator');
    const anyManip = Manip as any;
    const rect = { originX, originY, width: cw, height: ch };
    const saveFormat = anyManip.SaveFormat?.JPEG ?? 'jpeg';
    const done = (out: any) =>
      out?.uri
        ? { uri: out.uri as string, width: out.width ?? cw, height: out.height ?? ch }
        : original;

    if (anyManip.ImageManipulator?.manipulate) {
      const ctx = anyManip.ImageManipulator.manipulate(uri).crop(rect);
      const rendered = await ctx.renderAsync();
      return done(await rendered.saveAsync({ compress: 0.9, format: saveFormat }));
    }
    if (anyManip.manipulateAsync) {
      return done(
        await anyManip.manipulateAsync(uri, [{ crop: rect }], {
          compress: 0.9,
          format: saveFormat,
        }),
      );
    }
    return original;
  } catch {
    // Kırpma başarısızsa ham fotoğrafı kullan — akış bozulmasın
    return original;
  }
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
