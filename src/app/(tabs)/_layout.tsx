import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import { colors } from '@/theme';
import { font, luxe } from '@/theme/luxe';

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
        // Aktif/pasif tonlar birbirine yakındı, seçili sekme belli olmuyordu
        tabBarActiveTintColor: luxe.primaryDeep,
        tabBarInactiveTintColor: 'rgba(128,117,108,0.6)',
        tabBarStyle: {
          backgroundColor: '#FFFCFB',
          borderTopColor: 'rgba(227,192,160,0.45)',
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontFamily: font.bodyMedium,
          fontSize: 10.5,
          letterSpacing: 0.2,
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
