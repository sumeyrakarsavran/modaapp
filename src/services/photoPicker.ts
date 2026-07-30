import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

/**
 * Tüm fotoğraf adımları için ortak seçici.
 *
 * ⚠️ Android'in "donup çıkıyor" sorunu (logcat ile doğrulandı):
 * Kamera ve kırpma AYRI bir activity'de açılır; bizim uygulama arka plana
 * (cached, oom_adj≈700) düşer ve Samsung'un bellek yöneticisi onu ÖLDÜRÜR
 * (`am_proc_died ... 700,15` + `am_kill ... kill background`). Kırpma bitince
 * fotoğraf artık var olmayan sürece döner; uygulama sıfırdan başlar ve fotoğraf
 * kaybolur. Çökme değildir — bu yüzden crash log'da hiçbir iz yoktur.
 *
 * Çözüm (Expo'nun resmî yolu): `getPendingResultAsync()`. Ancak bu çağrının
 * uygulama YENİDEN BAŞLADIĞINDA açılan ekranda yapılması gerekir. Süreç
 * öldükten sonra router en baştan (`/` → today) başladığı için, kurtarmayı
 * kökte (`src/app/_layout.tsx`) yapıp fotoğrafı ilgili ekrana yönlendiriyoruz.
 * Fotoğrafın NE İÇİN çekildiği süreç ölümünden sağ çıksın diye diske yazılır.
 */

export type PickPurpose = 'garment' | 'selfie' | 'avatar' | 'model';

/** Kurtarma sonrası ekrana taşınan rota parametreleri. */
export const RECOVERED_PARAMS = { uri: 'rcUri', w: 'rcW', h: 'rcH' } as const;

const PURPOSE_KEY = 'betta-pending-photo-purpose';

export interface PickedPhoto {
  uri: string;
  width?: number;
  height?: number;
}

export interface PickOptions {
  fromCamera: boolean;
  /** Kırpma çerçevesi oranı, ör. [1, 1] kare, [3, 4] dikey */
  aspect?: [number, number];
  quality?: number;
  /** Süreç ölürse fotoğrafın hangi ekrana döneceğini bilmek için */
  purpose?: PickPurpose;
}

export async function pickPhoto({
  fromCamera,
  aspect = [1, 1],
  quality = 0.7,
  purpose,
}: PickOptions): Promise<PickedPhoto | null> {
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality,
    allowsEditing: true,
    aspect,
    // Web'de blob URI sayfa yenilenince ölür — data URI'ye çevirebilmek için
    base64: Platform.OS === 'web',
  };

  // Android: kamera/kırpma sırasında öldürülürsek amacı bilelim
  if (Platform.OS === 'android' && purpose) {
    await AsyncStorage.setItem(PURPOSE_KEY, purpose).catch(() => {});
  }

  try {
    let result: ImagePicker.ImagePickerResult | null = null;
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Kamera izni gerekli', 'Fotoğraf çekmek için kamera iznini açman gerekiyor.');
        return null;
      }
      result = await ImagePicker.launchCameraAsync(opts);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(opts);
    }
    return toPicked(result);
  } finally {
    // Normal dönüşte işaret gereksiz — temizle
    if (Platform.OS === 'android' && purpose) {
      await AsyncStorage.removeItem(PURPOSE_KEY).catch(() => {});
    }
  }
}

export interface RecoveredPhoto {
  photo: PickedPhoto;
  purpose: PickPurpose;
}

/**
 * Android: kamera/kırpma sırasında uygulama sistem tarafından öldürüldüyse
 * bekleyen fotoğrafı geri alır. Yalnızca KÖK layout çağırmalı (uygulama
 * yeniden başladığında ilk çalışan yer orasıdır).
 */
export async function recoverPendingPhoto(): Promise<RecoveredPhoto | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const pending = await ImagePicker.getPendingResultAsync();
    const stored = (await AsyncStorage.getItem(PURPOSE_KEY).catch(() => null)) as
      | PickPurpose
      | null;
    await AsyncStorage.removeItem(PURPOSE_KEY).catch(() => {});
    if (!pending) return null;
    // Dizi de dönebilir (SDK sürümüne göre) — ikisini de karşıla
    const first = Array.isArray(pending) ? pending[0] : pending;
    const photo = toPicked(first as ImagePicker.ImagePickerResult);
    if (!photo) return null;
    return { photo, purpose: stored ?? 'garment' };
  } catch {
    return null;
  }
}

function toPicked(result: unknown): PickedPhoto | null {
  const r = result as ImagePicker.ImagePickerResult | null;
  if (!r || (r as { canceled?: boolean }).canceled) return null;
  const asset = (r as ImagePicker.ImagePickerSuccessResult).assets?.[0];
  if (!asset?.uri) return null;
  const uri =
    Platform.OS === 'web' && asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
  return { uri, width: asset.width, height: asset.height };
}

/** Rota parametrelerinden kurtarılan fotoğrafı okur (ekranlar kullanır). */
export function photoFromParams(params: Record<string, unknown>): PickedPhoto | null {
  const uri = params[RECOVERED_PARAMS.uri];
  if (typeof uri !== 'string' || !uri) return null;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return { uri, width: num(params[RECOVERED_PARAMS.w]), height: num(params[RECOVERED_PARAMS.h]) };
}
