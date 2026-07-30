/**
 * Fotoğraftan baskın renk tespiti — iOS/Android.
 * Arka planı silinmiş PNG'lerde şeffaf pikseller SIYAH/BEYAZ sayılmasın diye
 * PNG dosyayı JS'te çözüp (fast-png) web ile AYNI algoritmayı kullanırız:
 * şeffaf pikseller atlanır, desen tespiti yapılır.
 * PNG çözülemezse (örn. JPEG) react-native-image-colors'a düşülür.
 */

import { colorIdFromPixels, nearestColorId } from '@/services/autotag';

export async function detectPhotoColor(imageUri: string): Promise<string | null> {
  // Bazı native modüller çıplak yol döndürür ("/data/...") — file:// garanti et
  const uri = imageUri.startsWith('/') ? `file://${imageUri}` : imageUri;

  // 1) PNG'yi piksel piksel çöz — şeffaflık doğru ele alınır
  const fromPixels = await decodePngAndAnalyze(uri).catch((e) => {
    if ((globalThis as any).__DEV__) console.warn('[colorDetect] png decode:', e);
    return null;
  });
  if (fromPixels) return fromPixels;

  // 2) Yedek: react-native-image-colors (JPEG vb. — şeffaflık yok, sorun değil)
  try {
    const { getColors } = await import('react-native-image-colors');
    const result = await getColors(imageUri, { fallback: '', cache: false });
    let hex: string | undefined;
    if (result.platform === 'android') {
      hex = result.vibrant || result.dominant || result.average;
    } else if (result.platform === 'ios') {
      hex = result.primary || result.background;
    }
    if (!hex) return null;
    return nearestColorId(hex);
  } catch {
    return null;
  }
}

async function decodePngAndAnalyze(imageUri: string): Promise<string | null> {
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' as any });
  // ~9MB üstü dosyalarda tam çözümden kaçın (bellek) — yedek yönteme düş
  if (base64.length > 12_000_000) return null;
  const { toByteArray } = await import('base64-js');
  const bytes = toByteArray(base64);

  // PNG imzası kontrolü
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;

  let decode;

  try {
    ({ decode } = await import("fast-png"));
  } catch (e) {
    console.warn(e);
    return null;
  }
  
  const png = decode(bytes);
  const channels = png.channels === 4 ? 4 : 3;
  let data: Uint8Array;
  if (png.data instanceof Uint8Array) {
    data = png.data;
  } else {
    // 16-bit PNG → 8-bit'e ölçekle
    const src = png.data as Uint16Array;
    data = new Uint8Array(src.length);
    for (let i = 0; i < src.length; i++) data[i] = src[i] >> 8;
  }
  return colorIdFromPixels(data, channels as 3 | 4);
}
