const { withMainApplication } = require('expo/config-plugins');

/**
 * ONNX Runtime'ın native modülünü MainApplication'a KAYDEDER.
 *
 * Neden gerekli: `onnxruntime-react-native` paketi Android tarafında eski tip
 * bir `ReactPackage` (`OnnxruntimePackage`) sunuyor, ama hiçbir otomatik
 * bağlama onu kaydetmiyor:
 *   - Paketin kendi `app.plugin.js`'i YALNIZCA gradle bağımlılığını ekliyor
 *     (`implementation project(':onnxruntime-react-native')`), kaydı yapmıyor.
 *   - RN CLI autolinking paketi atlıyor, çünkü `unimodule.json` taşıyor
 *     (yani "bunu Expo yönetiyor" diyor).
 *   - Expo'nun modern autolinking'i ise yalnızca Expo `Module`'lerini kaydeder,
 *     eski `ReactPackage`'leri değil.
 *
 * Sonuç: kütüphane APK'ya giriyor ama `NativeModules.Onnxruntime` null kalıyor
 * ve paket import edilir edilmez patlıyor:
 *   ERROR [TypeError: Cannot read property 'install' of null]
 * Uygulama açılış ekranında takılı kalıyor — hata ekranı bile göremiyorsun.
 *
 * `android/` git'te izlenmiyor (prebuild üretir), o yüzden bu kayıt elle
 * MainApplication.kt'ye yazılamaz; plugin şart.
 */
const IMPORT = 'import ai.onnxruntime.reactnative.OnnxruntimePackage';
const REGISTER = 'add(OnnxruntimePackage())';

module.exports = function withOnnxruntimePackage(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;

    if (!src.includes(IMPORT)) {
      // expo importlarının hemen üstüne ekle (alfabetik olarak da oraya düşüyor)
      src = src.replace(
        /^import expo\.modules\.ApplicationLifecycleDispatcher/m,
        `${IMPORT}\nimport expo.modules.ApplicationLifecycleDispatcher`,
      );
    }

    if (!src.includes(REGISTER)) {
      // Şablonun "elle eklenecek paketler" yorumunun altına yaz
      const anchor = /^(\s*)\/\/ add\(MyReactNativePackage\(\)\)$/m;
      if (anchor.test(src)) {
        src = src.replace(anchor, `$1// add(MyReactNativePackage())\n$1${REGISTER}`);
      } else {
        throw new Error(
          'withOnnxruntimePackage: MainApplication içinde paket ekleme noktası bulunamadı. ' +
            'Expo şablonu değişmiş olabilir — plugin güncellenmeli.',
        );
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
