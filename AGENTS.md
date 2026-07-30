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
- Native modüller (`@six33/react-native-bg-removal`, `@react-native-ml-kit/image-labeling`,
  `react-native-image-colors`, `expo-image-manipulator`) dinamik `import()` ile ve try/catch
  içinde çağrılır; yoksa özellik sessizce atlanır. Ama Metro yine de paketleme anında bu
  modülleri **çözebilmek zorunda** — package.json'dan silinmemeliler.
- Android: `android/gradle.properties` içinde `reactNativeArchitectures=arm64-v8a`
  (APK'yı küçük tutar, "not enough space" kurulum hatasını önler).
