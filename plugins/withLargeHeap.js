const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Android: <application android:largeHeap="true">
 *
 * Neden gerekli: arka kamera fotoğrafları ön kameradan çok daha büyük
 * (Samsung'da 50MP+ → 8160×6120). expo-image-picker'ın kırpma ekranı ve
 * expo-image-manipulator (Glide ile TAM çözünürlükte decode eder, override
 * yok) bu bitmap'i BİZİM sürecimizde açar: 50MP × 4 bayt ≈ 200MB. Standart
 * heap'te (~256MB) bu OOM demek; süreç ölür, kurtarma sonrası aynı fotoğraf
 * tekrar işlenmeye çalışılınca yine ölür ve döngüye girer. Ön kamera (~12MP
 * ≈ 48MB) sığdığı için çalışır — "arka kamera çalışmıyor, ön kamera çalışıyor"
 * tam olarak budur.
 *
 * android/ klasörü git'te İZLENMİYOR (prebuild üretiyor), bu yüzden ayarı
 * yalnızca AndroidManifest.xml'e yazmak yetmez — prebuild onu ezer.
 */
module.exports = function withLargeHeap(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults?.manifest?.application?.[0];
    if (application?.$) {
      application.$['android:largeHeap'] = 'true';
    }
    return cfg;
  });
};
