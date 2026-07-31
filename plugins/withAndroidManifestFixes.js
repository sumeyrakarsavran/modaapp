const { withAndroidManifest } = require('expo/config-plugins');

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
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults?.manifest;
    const application = manifest?.application?.[0];
    if (!application?.$) return cfg;

    // tools: ad alanı tools:replace için şart
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

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
