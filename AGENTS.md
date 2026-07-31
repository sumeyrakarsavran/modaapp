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
- Android: `android/gradle.properties` içinde `reactNativeArchitectures=arm64-v8a`
  (APK'yı küçük tutar, "not enough space" kurulum hatasını önler).
