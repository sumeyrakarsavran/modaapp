import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinBlob } from '@/components/FinBlob';
import { useStore } from '@/store/useStore';
import { colors } from '@/theme';
import { font, glass, iridescent, luxe } from '@/theme/luxe';

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
          Aktif sekme örnekteki gibi yamuk pembe bir blobun içinde.
          `tabBarIcon`'u bir View ile sarmalamak ÇALIŞMIYOR: sekme çubuğunun
          sabit yükseklikli ikon kabı sarmalayıcıyı kırpıyor, glif hiç
          görünmüyor (cihazda doğrulandı). Bunun yerine `tabBarButton` ile
          öğenin TAMAMI devralınıyor; blob ikon+etiketin arkasında ayrı bir
          katman olarak duruyor.
        */
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarActiveTintColor: luxe.primaryDeep,
        tabBarInactiveTintColor: 'rgba(138,135,144,0.6)',
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

/**
 * Sekme öğesinin tamamı: seçiliyken ikon+etiketin arkasına yamuk pembe blob.
 * `accessibilityState.selected` react-navigation'ın seçili sekme işareti.
 */
function TabButton(props: Record<string, any>) {
  const { children, onPress, onLongPress } = props;
  /*
    Seçili işareti sürüme göre `aria-selected` VEYA
    `accessibilityState.selected` olarak geliyor; ikisi de okunuyor.
    Yalnızca birine bakınca hiçbir sekme seçili görünmüyordu (cihazda test
    edildi: blob hiç çizilmedi).
  */
  const focused = !!(props['aria-selected'] ?? props.accessibilityState?.selected);
  return (
    <Pressable
      onPress={onPress ?? undefined}
      onLongPress={onLongPress ?? undefined}
      style={styles.tabBtn}
      android_ripple={null}
    >
      <View style={styles.tabInner}>
        {focused ? <FinBlob color={luxe.primaryContainer} gradient={iridescent.soft} /> : null}
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBtn: { flex: 1, alignItems: 'stretch', justifyContent: 'center' },
  tabInner: { alignSelf: 'stretch', marginHorizontal: 3, paddingVertical: 7, alignItems: 'center' },
});
