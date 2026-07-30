/**
 * Fotoğraftan nesne etiketleri — iOS/Android (ÜCRETSİZ, cihaz-içi).
 * Google ML Kit Image Labeling: 400+ genel etiket ("Jeans", "Dress", "Shoe"...).
 * Native modül yoksa (Expo Go) null döner; akış bozulmaz.
 */

import { withTimeout } from '@/services/async';

export async function classifyPhotoLabels(imageUri: string): Promise<string[] | null> {
  try {
    const ImageLabeling = (await import('@react-native-ml-kit/image-labeling')).default;
    const results = await withTimeout(
      ImageLabeling.label(imageUri),
      15000,
      null as { text: string; confidence?: number }[] | null,
      'görsel sınıflandırma',
    );
    if (!Array.isArray(results) || !results.length) return null;
    return results
      .filter((r: { confidence?: number }) => (r.confidence ?? 0) > 0.5)
      .map((r: { text: string }) => r.text);
  } catch {
    return null;
  }
}
