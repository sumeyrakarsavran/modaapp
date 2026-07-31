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
- **Renk tespiti küçültülmüş kopyadan YAPILMAZ.** `detectPhotoColor` her zaman arka planı
  silinmiş PNG'nin KENDİSİNİ alır (`processGarmentPhoto` çıktısı). Analiz kopyası
  (`resizeForAnalysis`) Glide + ImageManipulator round-trip'inden geçer ve şeffaflığın
  korunduğu garanti değildir; şeffaflık kaybolunca silinen arka plan ortalamaya karışır ve
  her şey "siyah" çıkar. Küçük kopya yalnızca ML Kit etiketleme + Claude için kullanılır
  (onlar alfaya bakmaz). Kaydedilen fotoğraf zaten ≤1200px, bellek sorun değil.
- **Arka kamera = büyük bitmap.** Arka kamera fotoğrafı ön kameradan kat kat büyüktür
  (Samsung 50MP+ → 8160×6120 ≈ 200MB bitmap; ön kamera ~12MP ≈ 48MB). Kırpma ekranı ve
  `expo-image-manipulator` (Glide ile TAM çözünürlükte decode eder, override yok) bu
  bitmap'i BİZİM sürecimizde açar → standart heap'te OOM. Kurtarma sonrası aynı fotoğraf
  yeniden işlendiği için döngüye girer: "arka kamera çalışmıyor, ön kamera çalışıyor".
  Çözüm `android:largeHeap="true"`. `android/` klasörü **git'te izlenmiyor** (prebuild
  üretir), bu yüzden ayar `plugins/withLargeHeap.js` config plugin'inde tutulur —
  yalnızca `AndroidManifest.xml`'e yazmak prebuild'de kaybolur. Doğrulama:
  `npx expo config --type introspect | grep largeHeap`. Native değişiklik →
  `npx expo run:android` ile YENİDEN DERLEME şart, Metro reload yetmez.
- Android: `android/gradle.properties` içinde `reactNativeArchitectures=arm64-v8a`
  (APK'yı küçük tutar, "not enough space" kurulum hatasını önler).
