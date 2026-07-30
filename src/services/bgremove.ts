import { removeBackgroundLocal } from '@/services/localBgRemove';
import { persistGarmentPhoto } from '@/services/photoStore';

/**
 * Ürün fotoğrafı işleme hattı:
 * 1. ÜCRETSİZ cihaz-içi arka plan silme
 *    - iOS/Android: @six33/react-native-bg-removal (Vision / MLKit) — anahtarsız
 *    - Web: @imgly/background-removal (WASM) — anahtarsız
 * 2. Cihaz-içi başarısızsa ve remove.bg anahtarı girilmişse API ile dene (opsiyonel yedek)
 * 3. Hiçbiri olmazsa orijinal fotoğraf kullanılır — akış asla bozulmaz
 * 4. Sonuç KALICI depoya kaydedilir (belge dizini / data URI)
 */
export async function processGarmentPhoto(
  imageUri: string,
  removeBgKey?: string,
): Promise<{ uri: string; removed: boolean }> {
  let processed: string | null = null;

  // 1) Ücretsiz, cihaz-içi
  processed = await removeBackgroundLocal(imageUri);

  // 2) Opsiyonel remove.bg yedeği
  if (!processed && removeBgKey) {
    processed = await removeBgApi(imageUri, removeBgKey);
  }

  const removed = processed != null;
  const finalUri = await persistGarmentPhoto(processed ?? imageUri).catch(
    () => processed ?? imageUri,
  );
  return { uri: finalUri, removed };
}

/** remove.bg API (yalnızca anahtar girilmişse denenir). */
async function removeBgApi(imageUri: string, key: string): Promise<string | null> {
  try {
    const form = new FormData();
    if (imageUri.startsWith('http')) {
      form.append('image_url', imageUri);
    } else {
      form.append('image_file', {
        uri: imageUri,
        name: 'garment.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
    }
    form.append('size', 'auto');
    form.append('format', 'png');

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': key },
      body: form,
    });
    if (!res.ok) return null;

    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
