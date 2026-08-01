import { Platform } from 'react-native';

import { uid } from '@/types';

/**
 * İşlenmiş ürün fotoğrafını KALICI olarak kaydeder.
 * - Native: belge dizinine kopyalanır (galeri/önbellek URI'leri OS tarafından
 *   silinebilir; belge dizini uygulamayla birlikte yaşar).
 * - Web: data URI'ye çevrilir (store ile birlikte localStorage'da saklanır).
 */
/**
 * Uzaktaki bir görseli (ör. FASHN çıktısı) KALICI olarak indirir.
 * FASHN'ın döndürdüğü URL geçicidir; kaydetmezsek sanal deneme sonuçları
 * bir süre sonra kırık görsele döner.
 */
export async function persistRemoteImage(url: string): Promise<string> {
  if (Platform.OS === 'web') return url;
  const FileSystem = await import('expo-file-system/legacy');
  const dir = `${FileSystem.documentDirectory}tryons/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const ext = /\.png(\?|$)/i.test(url) ? 'png' : 'jpg';
  const dest = `${dir}tryon-${uid()}.${ext}`;
  const res = await FileSystem.downloadAsync(url, dest);
  return res.uri;
}

export async function persistGarmentPhoto(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) return uri;
    const blob = await (await fetch(uri)).blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  // Bazı native modüller çıplak yol döndürür ("/data/...") — file:// garanti et
  if (uri.startsWith('/')) uri = `file://${uri}`;

  const FileSystem = await import('expo-file-system/legacy');
  const dir = `${FileSystem.documentDirectory}garments/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const ext = uri.startsWith('data:image/jpeg') || uri.endsWith('.jpg') ? 'jpg' : 'png';
  const dest = `${dir}garment-${uid()}.${ext}`;

  if (uri.startsWith('data:')) {
    const base64 = uri.split(',')[1] ?? '';
    await FileSystem.writeAsStringAsync(dest, base64, { encoding: 'base64' as any });
  } else {
    await FileSystem.copyAsync({ from: uri, to: dest });
  }
  return dest;
}
