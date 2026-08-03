import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import { colors } from '@/theme';
import { font, glass, luxe } from '@/theme/luxe';

export default function TabsLayout() {
  const account = useStore((s) => s.account);
  const signedIn = useStore((s) => s.signedIn);
  const insets = useSafeAreaInsets();

  // Yerel hesap varsa ve oturum kapalıysa önce giriş iste
  if (account && !signedIn) {
    return <Redirect href="/auth" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        /*
          Editoryal sekme çubuğu: ince çizgi ikonlar, küçük harf aralıklı
          etiketler, sıcak kahve/kum paleti (`src/theme/luxe.ts`).
          `sceneStyle` bilerek ESKİ zeminde bırakıldı — henüz yeni tasarıma
          geçmemiş sekmelerin zeminini değiştirmesin.
        */
        /*
          Aktif sekme örnekteki gibi "hap" içine ALINAMADI: ikonu bir View ile
          sarmalayınca glif hiç çizilmiyor (hap görünüyor, ikon yok) — cihazda
          doğrulandı, sarmalayıcı kalkınca ikonlar geri geliyor. Ayrım renkle
          yapılıyor. Hap isteniyorsa özel `tabBarButton` gerekir.
        */
        tabBarActiveTintColor: luxe.primary,
        tabBarInactiveTintColor: 'rgba(128,116,117,0.55)',
        tabBarStyle: {
          backgroundColor: glass.fillStrong,
          borderTopColor: glass.border,
          borderTopWidth: 1,
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontFamily: font.label,
          fontSize: 9,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          paddingBottom: 6,
        },
        tabBarIconStyle: { marginBottom: -2 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Bugün',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: 'Gardırop',
          tabBarIcon: ({ color, size }) => (
            // Askı ikonu Ionicons'ta yok, MaterialCommunityIcons'tan
            <MaterialCommunityIcons name="hanger" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: 'Stüdyo',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="auto-fix" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Topluluk',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Akvaryum',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="waves" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

