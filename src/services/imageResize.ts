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
  maxDim = 1200,
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
    // Küçültmeyi AYNI geçişte yap: her manipulate() çağrısı fotoğrafı Glide ile
    // TAM çözünürlükte yeniden decode eder (12MP ≈ 48MB). Kırpma ve küçültmeyi
    // ayrı ayrı çağırmak bu pahalı decode'u iki kez yaptırıyordu.
    const scale = Math.max(cw, ch) > maxDim ? maxDim / Math.max(cw, ch) : 1;
    const outW = Math.max(1, Math.round(cw * scale));
    const outH = Math.max(1, Math.round(ch * scale));
    const needsCrop = cw !== width || ch !== height;
    if (!needsCrop && scale === 1) return original;

    const Manip = await import('expo-image-manipulator');
    const anyManip = Manip as any;
    const rect = { originX, originY, width: cw, height: ch };
    const saveFormat = anyManip.SaveFormat?.JPEG ?? 'jpeg';
    const done = (out: any) =>
      out?.uri
        ? { uri: out.uri as string, width: out.width ?? outW, height: out.height ?? outH }
        : original;

    if (anyManip.ImageManipulator?.manipulate) {
      let ctx = anyManip.ImageManipulator.manipulate(uri);
      if (needsCrop) ctx = ctx.crop(rect);
      if (scale !== 1) ctx = ctx.resize({ width: outW });
      const rendered = await ctx.renderAsync();
      return done(await rendered.saveAsync({ compress: 0.9, format: saveFormat }));
    }
    if (anyManip.manipulateAsync) {
      const actions: any[] = [];
      if (needsCrop) actions.push({ crop: rect });
      if (scale !== 1) actions.push({ resize: { width: outW } });
      return done(
        await anyManip.manipulateAsync(uri, actions, { compress: 0.9, format: saveFormat }),
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
 * Analiz (renk + sınıflandırma) için küçük kopya — ~512px PNG.
 *
 * PNG şart: arka planı silinmiş fotoğrafın ŞEFFAFLIĞI korunmalı, yoksa
 * renk analizi silinen arka planı da sayar (UPNG.toRGBA8 alfayı korur).
 * Boyut, iki ihtiyacın dengesi: PNG'yi saf JS'te çözmek pahalı (1200px'te
 * 1.44M piksel, Hermes'te onlarca saniye), ama ML Kit etiketleme çok küçük
 * görselde isabetini kaybediyor. 512px ≈ 262K piksel — yaklaşık 5 kat ucuz.
 */
export async function resizeForAnalysis(uri: string, maxDim = 512): Promise<string> {
  try {
    return await resizeTo(uri, maxDim, 'png');
  } catch {
    return uri;
  }
}
