const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Kıyafet sınıflandırma modeli (assets/models/clothing-classifier.onnx) diğer
// varlıklar gibi require() ile paketleniyor. Bu satır olmadan Metro `.onnx`
// uzantısını tanımaz ve require hata verir.
config.resolver.assetExts.push('onnx');

/**
 * Android derleme çıktılarını izleme.
 *
 * Gradle derleme sırasında `android/app/.cxx/...` ve `android/app/build/...`
 * altında binlerce dosya yaratıp siliyor. Metro'nun dosya izleyicisi silinen
 * bir klasörü izlemeye çalışınca ÇÖKÜYOR (Windows'ta gözlendi):
 *   Error: ENOENT: no such file or directory, watch
 *   '...\android\app\.cxx\Debug\...\CMakeFiles\appmodules.dir'
 * Metro sessizce ölüyor, uygulama da açılış ekranında takılı kalıyor.
 * Bu klasörlerde kaynak kod yok; izlememek ayrıca Metro'yu hızlandırıyor.
 */
config.resolver.blockList = [
  /\/android\/app\/\.cxx\/.*/,
  /\/android\/app\/build\/.*/,
  /\/android\/\.gradle\/.*/,
  /\\android\\app\\\.cxx\\.*/,
  /\\android\\app\\build\\.*/,
  /\\android\\\.gradle\\.*/,
];

module.exports = config;
