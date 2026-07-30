/**
 * Cihaz-içi ÜCRETSİZ arka plan silme — iOS/Android.
 * @six33/react-native-bg-removal: iOS 17+ Vision, Android MLKit Subject Segmentation.
 * Native modül yoksa (örn. Expo Go) veya desteklenmiyorsa null döner; akış bozulmaz.
 */

export async function removeBackgroundLocal(imageUri: string): Promise<string | null> {
  try {
    const mod = await import('@six33/react-native-bg-removal');
    const supported = await mod.isNativeBackgroundRemovalSupported().catch(() => false);
    if (!supported) return null;
    const out = await mod.removeBackground(imageUri, { trim: true });
    return out || null;
  } catch {
    // Native modül yüklü değil (Expo Go) ya da işleme hatası — sessizce vazgeç
    return null;
  }
}
