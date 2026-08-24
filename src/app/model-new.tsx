import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { Button } from '@/components/UI';
import { useStore } from '@/store/useStore';
import { font, glass, iridescent, luxe, luxeRadius, luxeType } from '@/theme/luxe';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * KENDİ MANKENİNİ OLUŞTUR — kısa anket.
 *
 * Cevaplar saklanıyor; manken GÖRSELİ burada üretilmiyor. Üretim (FASHN ya da
 * benzeri bir görsel servisi) sonradan bağlanacak ve `CustomModel.imageUri`
 * alanına yazılacak — o zamana dek arayüz siluet + tarif gösteriyor.
 */
const HAIR = ['Siyah', 'Kahve', 'Sarı', 'Kızıl', 'Gri', 'Renkli'];
const HAIR_LEN = ['Kısa', 'Orta', 'Uzun'];
const SKIN = ['Açık', 'Buğday', 'Esmer', 'Koyu'];
const SIZES = ['34', '36', '38', '40', '42', '44', '46', '48'];
const BODY = ['İnce', 'Ortalama', 'Kıvrımlı', 'Atletik'];

export default function ModelNew() {
  const { addModel, setSelectedModel } = useStore();

  const [name, setName] = useState('');
  const [hair, setHair] = useState(HAIR[0]);
  const [hairLength, setHairLength] = useState(HAIR_LEN[2]);
  const [skin, setSkin] = useState(SKIN[1]);
  const [size, setSize] = useState('38');
  const [height, setHeight] = useState('165');
  const [bodyType, setBodyType] = useState(BODY[1]);

  const create = () => {
    const m = addModel({
      name: name.trim() || 'Modelim',
      hair,
      hairLength,
      skin,
      size,
      height: height.trim() || '165',
      bodyType,
    });
    setSelectedModel({ kind: 'custom', id: m.id });
    // Seçim ekranına dönmeye gerek yok: manken hazır, doğrudan stüdyoya
    router.replace('/tryon');
  };

  const Chips = ({
    label,
    options,
    value,
    onPick,
  }: {
    label: string;
    options: string[];
    value: string;
    onPick: (v: string) => void;
  }) => (
    <View style={styles.block}>
      <Text style={luxeType.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((o) => {
          const on = value === o;
          return (
            <Pressable
              key={o}
              onPress={() => onPick(o)}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}
            >
              {on ? (
                <LinearGradient
                  colors={iridescent.soft}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.chipFill}
                  pointerEvents="none"
                />
              ) : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={luxeType.display}>Modelini oluştur</Text>
          <Text style={[luxeType.label, { marginTop: 2 }]}>Birkaç soru</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.block}>
            <Text style={luxeType.label}>Adı</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Örn. Modelim"
              placeholderTextColor={luxe.outline}
              style={styles.input}
            />
          </View>

          <Chips label="Saç rengi" options={HAIR} value={hair} onPick={setHair} />
          <Chips label="Saç boyu" options={HAIR_LEN} value={hairLength} onPick={setHairLength} />
          <Chips label="Ten tonu" options={SKIN} value={skin} onPick={setSkin} />
          <Chips label="Beden" options={SIZES} value={size} onPick={setSize} />
          <Chips label="Vücut tipi" options={BODY} value={bodyType} onPick={setBodyType} />

          <View style={styles.block}>
            <Text style={luxeType.label}>Boy (cm)</Text>
            <TextInput
              value={height}
              onChangeText={(v) => setHeight(v.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder="165"
              placeholderTextColor={luxe.outline}
              style={[styles.input, { width: 120 }]}
              keyboardType="number-pad"
            />
          </View>

          <Text style={[luxeType.tiny, { marginBottom: 18 }]}>
            Bu bilgiler mankenin tarifi olarak saklanıyor. Görsel üretimi ayrıca bağlanacak; o
            zamana kadar manken listede siluet olarak görünür.
          </Text>

          <Button title="Modeli oluştur" onPress={create} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: glass.fill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
  },
  container: { paddingHorizontal: 20, paddingBottom: 50 },
  block: { marginBottom: 18 },
  input: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    fontFamily: font.body,
    fontSize: 15,
    color: luxe.ink,
    backgroundColor: luxe.surface,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    backgroundColor: glass.fill,
    paddingVertical: 9,
    paddingHorizontal: 15,
    overflow: 'hidden',
  },
  chipOn: { borderColor: luxe.primarySoft },
  chipFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  chipText: { fontFamily: font.bodyMedium, fontSize: 13, color: luxe.outline },
  chipTextOn: { color: luxe.primaryDeep },
});
