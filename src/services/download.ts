import { Platform } from 'react-native';

/**
 * Görseli CİHAZA indirir.
 *
 * `expo-media-library` / `expo-sharing` KURULU DEĞİL ve kurmak native yeniden
 * derleme gerektiriyor. Bunun yerine Android'in Depolama Erişim Çerçevesi
 * (SAF) kullanılıyor: kullanıcı bir klasör seçiyor (İndirilenler, Resimler…),
 * dosya oraya yazılıyor. Ek bağımlılık yok.
 *
 * Seçilen klasör OTURUM boyunca hatırlanıyor — her indirmede klasör sorulması
 * gereksiz sürtünme. Uygulama kapanınca unutuluyor (kalıcı izin saklamıyoruz).
 */
let rememberedDir: string | null = null;

export type SaveResult = 'saved' | 'cancelled' | 'unsupported' | 'error';

export async function saveImageToDevice(uri: string, fileName: string): Promise<SaveResult> {
  if (Platform.OS !== 'android') return 'unsupported';
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const SAF = FileSystem.StorageAccessFramework;

    if (!rememberedDir) {
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm.granted) return 'cancelled';
      rememberedDir = perm.directoryUri;
    }

    // Uzak adres kaldıysa önce yerel bir kopya indiriliyor
    let localUri = uri;
    if (uri.startsWith('http')) {
      const tmp = `${FileSystem.cacheDirectory}dl-${Date.now()}.png`;
      const res = await FileSystem.downloadAsync(uri, tmp);
      localUri = res.uri;
    }

    const b64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' as any });
    const dest = await SAF.createFileAsync(rememberedDir, fileName, 'image/png');
    await FileSystem.writeAsStringAsync(dest, b64, { encoding: 'base64' as any });
    return 'saved';
  } catch {
    // Klasör izni geri alınmış olabilir — bir dahakine yeniden sorulsun
    rememberedDir = null;
    return 'error';
  }
}
