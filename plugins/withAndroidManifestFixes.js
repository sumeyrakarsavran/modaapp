const { withAndroidManifest, withGradleProperties } = require('expo/config-plugins');

/**
 * Yalnızca arm64-v8a derle.
 *
 * ⚠️ ONNX Runtime geldikten sonra bu ayar KRİTİK: `libonnxruntime.so` tek başına
 * arm64 için 27MB, dört ABI birden 112MB. `expo.useLegacyPackaging=false`
 * olduğu için native kütüphaneler APK'ya SIKIŞTIRILMADAN giriyor, yani bu
 * doğrudan APK boyutu demek. Daha önce "not enough space" kurulum hatası aldık.
 *
 * gradle.properties'i prebuild yeniden ürettiği için elle yazmak yetmez.
 */
function withArm64Only(config) {
  return withGradleProperties(config, (cfg) => {
    const KEY = 'reactNativeArchitectures';
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === KEY),
    );
    cfg.modResults.push({ type: 'property', key: KEY, value: 'arm64-v8a' });
    return cfg;
  });
}

/**
 * BETTA — Android manifest düzeltmeleri.
 *
 * android/ klasörü git'te İZLENMİYOR (prebuild üretir), bu yüzden bu ayarları
 * doğrudan AndroidManifest.xml'e yazmak YETMEZ — prebuild onları ezer.
 *
 * 1) android:largeHeap="true"
 *    Kırpma/işleme adımları bitmap'i bizim sürecimizde açar; expo-image-manipulator
 *    Glide ile TAM çözünürlükte decode eder (override yok). Büyük fotoğraflarda
 *    standart heap yetmiyor.
 *
 * 2) com.google.mlkit.vision.DEPENDENCIES çakışması
 *    @six33/react-native-bg-removal "subject_segment", expo-camera "barcode_ui"
 *    tanımlıyor. Manifest merger bunu çözemez ve derleme şu hatayla patlar:
 *      Attribute meta-data#com.google.mlkit.vision.DEPENDENCIES@value ...
 *      is also present at [host.exp.exponent:expo.modules.camera] ... value=(barcode_ui)
 *    Çözüm: iki değeri birleştirip tools:replace ile üzerine yaz.
 */
module.exports = function withAndroidManifestFixes(config) {
  config = withArm64Only(config);
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults?.manifest;
    const application = manifest?.application?.[0];
    if (!application?.$) return cfg;

    // tools: ad alanı tools:replace için şart
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    // Cihaz depolaması dolduğunda sistem APK'yı taşıyabilsin. ONNX Runtime'ın
    // 27MB'lık native kütüphanesinden sonra daha da önemli — daha önce
    // "not enough space" kurulum hatası almıştık.
    manifest.$['android:installLocation'] = 'auto';

    application.$['android:largeHeap'] = 'true';

    const NAME = 'com.google.mlkit.vision.DEPENDENCIES';
    application['meta-data'] = application['meta-data'] || [];
    const existing = application['meta-data'].find((m) => m?.$?.['android:name'] === NAME);
    const entry = existing ?? { $: { 'android:name': NAME } };
    entry.$['android:value'] = 'subject_segment,barcode_ui';
    entry.$['tools:replace'] = 'android:value';
    if (!existing) application['meta-data'].push(entry);

    return cfg;
  });
};
