# BETTA — geliştirici notları

Betta balığı temalı dijital gardırop uygulaması. Expo SDK 57 (dokümanlar:
https://docs.expo.dev/versions/v57.0.0/), expo-router (`src/app`), TypeScript strict,
zustand + AsyncStorage.

## ⚠️ ÖNCE BUNU OKU: sürüm kontrolü
Bu repoda uzun süre **hiç commit yoktu**. 30 Temmuz 2026'da VSCode'da "discard changes"
yapılınca geri dönülecek bir commit olmadığı için **tüm proje dosyaları silindi**
(çöp kutusundan kurtarıldı). Bir daha yaşanmaması için:
- Anlamlı her değişiklikten sonra `git add -A && git commit -m "..."` yap.
- Şablon dosyalarını (`index.tsx`, `_layout.tsx`, `explore.tsx`, `themed-*`, `app-tabs`,
  `animated-icon`, `constants/theme.ts`) geri getirme — bunlar Expo şablonundan kalma,
  silindiler. Geri gelirlerse uygulama "Welcome to Expo" ekranını açar.

## Komutlar
- `npx expo run:android` — telefonda dev build (native modüller var, Expo Go yetmez)
- `npx expo start --web --port 8090` — web geliştirme
- `npx tsc --noEmit` — tip kontrolü

## Mimari
- `src/app/_layout.tsx` → kök Stack (BETTA). `src/app/index.tsx` → onboarding/today yönlendirmesi.
- `src/app/(tabs)/` → Bugün · Gardırop · Stüdyo · Topluluk · Akvaryum (profil sağ üst avatarda).
- `src/store/useStore.ts` → zustand + AsyncStorage; `src/theme`, `src/types`, `src/services`.

## Önemli kurallar
- UI dili Türkçe; tema renkleri ve betta arketipleri `src/theme/index.ts` içinde.
- Uygulama **anahtarsız tamamen çalışmalı**: her harici servis (Claude, FASHN, remove.bg,
  Supabase) opsiyoneldir ve anahtar yoksa zarif bir yerel geri düşüşü vardır.
- Store SSR-güvenli olmalı: `typeof window === 'undefined'` iken AsyncStorage'a dokunma
  (Expo web SSR Node'da çalıştırıyor). `app.json` → `web.output: "single"`.
- RN 0.86: `StyleSheet.absoluteFillObject` yok; düz obje kullan.
- Gerçek kıyafet fotoğrafları (arka planı silinmiş, şeffaf) HER ZAMAN `contentFit="contain"`
  ile gösterilir — `"cover"` uzun/dar parçaları (elbise, palto) kırpar. Selfie/avatar/model
  gibi gerçek insan fotoğrafları `"cover"` kalabilir.
- **Fotoğraf akışı tek yerden**: tüm ekranlar `src/services/photoPicker.ts` kullanır
  (kırpma açık). Android'de kamera/kırpma ayrı bir activity açar; uygulama cached'e
  düşünce Samsung'un bellek yöneticisi onu ÖLDÜRÜR — logcat kanıtı:
  `am_proc_died ... 700,15` + `am_kill ... kill background`, ardından süreç yalnızca
  `ImagePickerFileProvider` için yeniden doğar. Çökme DEĞİLDİR (crash log'da iz yoktur),
  bu yüzden dönüşte uygulama sıfırlanır ("donup çıkıyor").
  Çözüm kırpmayı kaldırmak DEĞİL, `getPendingResultAsync()` ile kurtarmaktır — ve bu
  **KÖKTE** (`src/app/_layout.tsx`) yapılmalıdır: süreç ölünce router en baştan
  (`/` → today) başlar, bu yüzden ekranların kendi içindeki kurtarma HİÇ ÇALIŞMAZ.
  Kök, fotoğrafı amacına göre (`garment/selfie/avatar/model`) doğru ekrana `rcUri`
  parametresiyle yollar; amaç, süreç ölümünden sağ çıksın diye AsyncStorage'a yazılır. Ağır adımlar (arka plan silme, ML Kit, PNG piksel çözümü) **küçültülmüş**
  kopya üzerinde ve SIRAYLA çalışır: kaydedilecek kopya ~1200px, analiz kopyası ~512px PNG
  (`imageResize.ts`). Tam boy fotoğrafı bu adımlara sokmak belleği taşırıp çökertir.
  Native çağrılar `withTimeout` ile sarılır (`services/async.ts`) — yoksa ekran donuk kalır.
- Native modüller (`@six33/react-native-bg-removal`, `@react-native-ml-kit/image-labeling`,
  `react-native-image-colors`, `expo-image-manipulator`) dinamik `import()` ile ve try/catch
  içinde çağrılır; yoksa özellik sessizce atlanır. Ama Metro yine de paketleme anında bu
  modülleri **çözebilmek zorunda** — package.json'dan silinmemeliler.
- **JS kütüphanelerini dinamik `import()` ile YÜKLEME — statik import kullan.**
  Cihazda kanıtlandı (2026-08-01): `await import('fast-png')` → `keys=[default]
  default=[]`, `await import('upng-js')` → `decode` undefined. Metro'nun ESM/CJS
  interop'u bu paketlerde ad alanını boş veriyor ve hata ancak ÇAĞRI anında
  "undefined is not a function" olarak patlıyor — üstelik `catch` ile yutulduğu için
  özellik sessizce kayboluyor. Dosya başında `import UPNG from 'upng-js'` çalışır.
  (Dinamik import yalnızca NATIVE modüller için: onlar yoksa özellik atlanmalı.)
- **PNG piksel çözme: `upng-js`** (CommonJS). `fast-png` saf ESM olduğu için React
  Native'de KULLANILAMAZ — kaldırıldı, geri ekleme. `UPNG.toRGBA8()` her zaman 8-bit
  RGBA verir: palet/16-bit farkları biter ve ŞEFFAFLIK korunur (silinmiş arka planı
  ayırt etmek için şart).
- **Renk tespiti küçük kopyadan yapılır** (`resizeForAnalysis`, 512px) — tam boy PNG'yi
  JS'te çözmek Hermes'te onlarca saniye sürüyor. Emniyet: arka plan silindiyse şeffaf
  piksel BEKLENİR; küçük kopyada hiç yoksa küçültme alfayı düşürmüş demektir ve tam boy
  ile bir kez daha denenir (`detectPhotoColor(small, fullSizeUri)`).
- ⚠️ **Yeni paket kurunca Metro'yu `-c` ile yeniden başlat.** Metro çalışırken paket
  kurulunca bayat/boş modül servis ediyor: kod paketin içinde göründüğü hâlde çalışma
  anında `undefined` geliyor. Teşhis: `npx expo export` ile üretilen temiz pakette kod
  VARSA ama cihazda yoksa, sorun önbellektir → `npx expo start -c`.
- **Kamera UYGULAMA İÇİNDE açılır — harici kamera uygulaması kullanma.**
  `launchCameraAsync` harici kamera uygulamasını açar; BETTA arka plana düşer ve
  Samsung'un bellek yöneticisi süreci öldürür (logcat: `am_proc_died` + `am_kill`).
  Cihaz Galaxy S20 FE / Android 13, boş RAM ~144MB — kamera uygulaması açılınca biz
  eleniyoruz. Galeri yolu HAFİF olduğu için sorunsuz çalışır; teşhis buradan gelir:
  "galeriden ekleyebiliyorum ama kamerayla çekemiyorum".
  `getPendingResultAsync()` bunu KURTARAMAZ — Expo'nun Android kaynağında
  `pendingMediaPickingResult` sıradan bir **bellek içi alandır** (SharedPreferences /
  savedInstanceState YOK); doküman da bunu "MainActivity öldüğünde" diye tarif eder,
  yani süreç yaşarken. Süreç ölünce alan da gider, çağrı hep `null` döner.
  Çözüm: `src/app/camera.tsx` (expo-camera) — ön planda kaldığımız için sistem bizi
  öldürmez. Kırpma da kendimiz yapılır (`cropToAspect`), çünkü sistem kırpma ekranı da
  ayrı bir activity'dir. `photoPicker.ts` native'de kamerayı bu ekrana yönlendirir ve
  sonucu `resolveCameraPhoto` ile söz olarak döndürür — çağıran ekranlar değişmedi.
  ⚠️ Kamera ekranı kapanırken sözü MUTLAKA çözmeli, yoksa çağıran ekran "işleniyor"da
  takılı kalır (unmount cleanup'ta `deliver(null)`).
- **Android manifest düzeltmeleri `plugins/withAndroidManifestFixes.js` içindedir**
  (`android/` git'te izlenmiyor, prebuild üretir → sadece manifest'e yazmak kaybolur):
  `largeHeap` ve MLKit `DEPENDENCIES` çakışması. `@six33/react-native-bg-removal`
  `subject_segment`, `expo-camera` `barcode_ui` tanımlar; manifest merger patlar,
  `tools:replace` ile `subject_segment,barcode_ui` yazılır.
  ⚠️ `expo run:android`, `android/` VARSA prebuild ÇALIŞTIRMAZ — plugin'i eklemek
  yetmez, aynı değişikliği `android/app/src/main/AndroidManifest.xml`'e de elle yaz.
  Doğrulama: `adb shell dumpsys package com.sumeyrakarsavran.betta | grep flags`
  → `LARGE_HEAP`. Native değişiklik → `npx expo run:android` şart, reload yetmez.
- **Klavye: `behavior="padding"` HER İKİ platformda da şart.** `edgeToEdgeEnabled=true`
  iken sistem pencereyi klavye için yeniden boyutlandırmaz (uygulama sistem çubuklarının
  arkasına çizer), yani manifest'teki `adjustResize` tek başına YETMEZ. Eski
  `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` kalıbı Android'de
  KeyboardAvoidingView'i tamamen devre dışı bırakıyordu: yazı alanı klavyenin altında
  kalıp görünmüyor ve tıklanamıyordu. Modal içindeki girişler için de KAV gerekir
  (`Modal` + `statusBarTranslucent`/`navigationBarTranslucent`).
  Alt boşluk: klavye AÇIKKEN `insets.bottom` EKLEME — KAV'ın eklediği klavye yüksekliği
  alt çubuğu zaten kapsıyor, yoksa çift sayılıp arada boşluk kalır (`Keyboard`
  dinleyicisiyle `keyboardUp` durumu tutulur).
- **Kıyafet sınıflandırma modeli (`assets/models/`).** MobileNetV3-Small, 20 sınıf,
  ONNX. Sözleşme `MODEL.md`'de (kaynak proje: `clothes-class`). Kritik noktalar:
  - `.onnx` ve `labels.json` **her zaman birlikte** taşınır — sınıf sırası ikisi
    arasında eşleşiyor, karıştırırsan model sessizce yanlış etiket üretir.
  - **Ön işleme en kritik kısım.** Model beyaz zemine ortalanmış, %8 kenar boşluklu
    TEK parça bekler. `classifyGarment` yalnızca arka planı GERÇEKTEN silinmiş
    (`removed === true`) görselle çağrılır; ham fotoğrafta isabet %78 → %30'a
    düşüyor (ölçülmüş). Alfa şart: JPEG'e çevirip düzleştirme, siyaha düşer.
  - ImageNet normalizasyonu ve softmax ONNX grafiğinin İÇİNDE — dışarıda tekrar
    uygulama, girdi ham `[0,1]` RGB.
  - **Bellek:** ONNX oturumu açıkken 30-80MB. Bu cihazda (boş RAM ~144MB) sürekli
    açık tutmak süreç ölümü riskini artırıyor → oturum `acquireClassifier()` /
    `releaseClassifier()` ile ekran ömrüne bağlı, kalıcı değil.
  - **⚠️ `onnxruntime-react-native` KENDİLİĞİNDEN KAYDOLMUYOR.** Paketin Android
    tarafı eski tip bir `ReactPackage` (`OnnxruntimePackage`) ama hiçbir otomatik
    bağlama onu kaydetmiyor: kendi `app.plugin.js`'i yalnızca gradle bağımlılığı
    ekliyor, RN CLI autolinking `unimodule.json` yüzünden atlıyor, Expo'nun
    modern autolinking'i de yalnızca Expo `Module`'lerini kaydediyor. Kütüphane
    APK'ya giriyor ama `NativeModules.Onnxruntime` null kalıyor ve import anında
    patlıyor: `TypeError: Cannot read property 'install' of null`. Uygulama
    açılış ekranında donuyor, hata ekranı bile çıkmıyor — teşhis Metro logundan.
    Çözüm: `plugins/withOnnxruntimePackage.js` MainApplication'a elle kaydediyor.
  - **⚠️ Gradle 9 uyumsuzluğu:** paketin `android/build.gradle`'ı `VersionNumber`
    API'sini kullanıyor, Gradle 9'da kaldırıldı → `Could not get unknown property
    'VersionNumber'`. `patches/onnxruntime-react-native+1.24.3.patch` bunu
    dosyanın zaten hesapladığı `REACT_NATIVE_MINOR_VERSION` ile değiştiriyor.
    `package.json` → `postinstall: patch-package` ile `npm install` sonrası
    otomatik uygulanıyor.
  - `metro.config.js` → `assetExts.push('onnx')` olmadan Metro modeli tanımaz.
    Aynı dosyada `blockList` ile `android/app/.cxx` ve `android/app/build`
    izlenmiyor: Gradle derleme sırasında oradaki klasörleri silince Metro'nun
    izleyicisi ENOENT ile ÇÖKÜYOR ve uygulama açılış ekranında kalıyor.
  - Model dosyası `InferenceSession.create`'e **yol olarak** verilir, Uint8Array
    olarak değil — 6MB'ı JS belleğine okumaya gerek yok.
- **Kategoriler modelin grup listesiyle hizalı** (`ust/alt/elbise/ic/ayakkabi/aksesuar`).
  Eski ayrı `dis` kategorisi KALDIRILDI; dış giyim artık `OUTER_SUBCATEGORY`
  (`jacket`) alt türü. Stüdyodaki dış giyim katmanı ve stilistin katmanlama
  mantığı bu alt türe bakıyor. Kayıtlı veri için store'da `version: 2` migrate'i
  var (`dis` → `ust` + `jacket`) — kategori setini değiştirirsen migrate şart,
  yoksa eski parçalar geçersiz kategoriye düşüp listelerden kaybolur.
- Android: `reactNativeArchitectures=arm64-v8a` — **ONNX'ten sonra kritik**:
  `libonnxruntime.so` arm64 için 27MB, dört ABI birden 112MB. `useLegacyPackaging=false`
  olduğu için native kütüphaneler APK'ya sıkıştırılmadan giriyor. Bu ayar ve
  `largeHeap`/`installLocation` `plugins/withAndroidManifestFixes.js` içinde —
  `android/` git'te izlenmiyor, elle yazmak prebuild'de kaybolur.
