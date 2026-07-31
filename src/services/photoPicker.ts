import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
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
 * `getPendingResultAsync()` bunu KURTARMAZ: Expo'nun Android kaynağında
 * `pendingMediaPickingResult` sıradan bir BELLEK İÇİ alandır (SharedPreferences
 * ya da savedInstanceState yok). Expo'nun kendi dokümanı da bunu "MainActivity
 * öldüğünde" diye tarif eder — yani süreç yaşarken activity ölmesi. Süreç
 * komple ölünce o alan da yok olur ve çağrı hep `null` döner.
 *
 * GERÇEK ÇÖZÜM: kameradan uygulamadan HİÇ ÇIKMAMAK. Native'de kamera artık
 * uygulama içi `/camera` ekranında (expo-camera) açılır; uygulama ön planda
 * kaldığı için sistem onu öldürmez. Kırpmayı da kendimiz yapıyoruz
 * (`cropToAspect`) — sistem kırpma ekranı da ayrı bir activity'dir.
 * Galeri yolu harici seçici kullanmaya devam eder: hafiftir, sorunsuz çalışır.
 * Kök kurtarma (`_layout.tsx`) yine de emniyet ağı olarak duruyor.
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
    // Native'de kamera UYGULAMA İÇİNDE açılır (aşağıdaki açıklamaya bak) —
    // harici kamera uygulaması bizim süreci öldürtüyor.
    if (fromCamera && Platform.OS !== 'web') {
      return await captureInApp(aspect);
    }

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

/* ————— Uygulama içi kamera ————— */

let cameraResolver: ((photo: PickedPhoto | null) => void) | null = null;

/**
 * Kamera ekranı sonucu buraya bildirir (fotoğraf ya da iptal için null).
 * Ekran kapanırken de çağrılmalı, yoksa bekleyen söz asla çözülmez ve
 * çağıran ekran "işleniyor" durumunda takılı kalır.
 */
export function resolveCameraPhoto(photo: PickedPhoto | null): void {
  const resolve = cameraResolver;
  cameraResolver = null;
  resolve?.(photo);
}

/** Uygulama içi kamera ekranını açar ve sonucu bekler. */
function captureInApp(aspect: [number, number]): Promise<PickedPhoto | null> {
  // Bekleyen eski bir istek varsa iptal et (ekran üst üste açılmasın)
  resolveCameraPhoto(null);
  return new Promise<PickedPhoto | null>((resolve) => {
    cameraResolver = resolve;
    router.push({
      pathname: '/camera',
      params: { aw: String(aspect[0]), ah: String(aspect[1]) },
    } as never);
  });
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
