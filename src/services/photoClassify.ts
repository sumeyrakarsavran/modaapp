/**
 * Fotoğraftan nesne etiketleri — iOS/Android (ÜCRETSİZ, cihaz-içi).
 * Google ML Kit Image Labeling: 400+ genel etiket ("Jeans", "Dress", "Shoe"...).
 * Native modül yoksa (Expo Go) null döner; akış bozulmaz.
 */

export async function classifyPhotoLabels(imageUri: string): Promise<string[] | null> {
  try {
    const ImageLabeling = (await import('@react-native-ml-kit/image-labeling')).default;
    const results = await ImageLabeling.label(imageUri);
    if (!Array.isArray(results) || !results.length) return null;
    return results
      .filter((r: { confidence?: number }) => (r.confidence ?? 0) > 0.5)
      .map((r: { text: string }) => r.text);
  } catch {
    return null;
  }
}
