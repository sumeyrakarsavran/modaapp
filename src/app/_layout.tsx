import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_600SemiBold_Italic,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RECOVERED_PARAMS, recoverPendingPhoto } from '@/services/photoPicker';
import { useStore } from '@/store/useStore';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

/** Kurtarılan fotoğrafın amacına göre döneceği ekran. */
const ROUTE_FOR_PURPOSE = {
  garment: '/item/new',
  selfie: '/(tabs)/wardrobe',
  avatar: '/profile',
  model: '/tryon',
} as const;

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);

  /*
    Editoryal tipografi (bkz. `src/theme/luxe.ts`).
    Yükleme BEKLENMİYOR: `useFonts` sonucu bilerek göz ardı ediliyor. Fontlar
    hazır değilken RN bilinmeyen aileyi sistem fontuna düşürüyor, yani ekran
    yine çizilir — açılışı font indirmeye bağlamak beyaz ekran riski demek.
  */
  useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_600SemiBold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  /**
   * Android: kamera/kırpma sırasında sistem uygulamayı öldürdüyse, yeniden
   * açılışta bekleyen fotoğrafı KÖKTE kurtarıp ilgili ekrana taşı. (Ekranların
   * kendi içinde kurtarma yapması işe yaramıyordu: süreç ölünce router en
   * baştan başladığı için o ekranlar hiç açılmıyor.)
   */
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (!hydrated || recoveredRef.current) return;
    recoveredRef.current = true;
    recoverPendingPhoto().then((rec) => {
      if (!rec) return;
      const { photo, purpose } = rec;
      // Navigator'ın bağlanmasını bekle
      setTimeout(() => {
        router.push({
          pathname: ROUTE_FOR_PURPOSE[purpose] ?? ROUTE_FOR_PURPOSE.garment,
          params: {
            [RECOVERED_PARAMS.uri]: photo.uri,
            [RECOVERED_PARAMS.w]: photo.width != null ? String(photo.width) : '',
            [RECOVERED_PARAMS.h]: photo.height != null ? String(photo.height) : '',
          },
        } as never);
      }, 120);
    });
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="item/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="canvas" options={{ presentation: 'fullScreenModal' }} />
        {/* Uygulama içi kamera — harici kamera uygulaması süreci öldürtüyor */}
        <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="quiz" options={{ presentation: 'modal' }} />
        <Stack.Screen name="stylist" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tryon" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pro" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile" />
      </Stack>
    </SafeAreaProvider>
  );
}
