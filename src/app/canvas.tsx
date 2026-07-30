import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentArt } from '@/components/GarmentArt';
import { ItemThumb } from '@/components/ItemThumb';
import { CANVAS_BASE } from '@/components/OutfitCollage';
import { Button, Chip } from '@/components/UI';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';
import { CATEGORIES, type Category, type WardrobeItem } from '@/types';

interface Placed {
  itemId: string;
  x: number;
  y: number;
  scale: number;
  z: number;
}

const BASE = CANVAS_BASE; // yerleştirilen parçanın taban boyutu (önizlemeyle ortak)

export default function Canvas() {
  const { outfitId } = useLocalSearchParams<{ outfitId?: string }>();
  const { items, outfits, addOutfit, updateOutfit } = useStore();
  const editing = outfits.find((o) => o.id === outfitId);

  const [placed, setPlaced] = useState<Placed[]>(() => {
    if (!editing) return [];
    return editing.itemIds.map((itemId, i) => {
      const l = editing.layout?.[itemId];
      return l
        ? { itemId, ...l }
        : { itemId, x: 30 + (i % 3) * 100, y: 30 + Math.floor(i / 3) * 120, scale: 1, z: i };
    });
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | 'hepsi'>('hepsi');
  // Kırpma tercihi: kapalı = tuval çerçevesi aynen korunur (WYSIWYG)
  const [cropToContent, setCropToContent] = useState<boolean>(editing?.cropToContent ?? false);
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const active = items.filter((i) => !i.archived);
  const strip = category === 'hepsi' ? active : active.filter((i) => i.category === category);

  const addToCanvas = (item: WardrobeItem) => {
    setPlaced((p) => {
      if (p.some((x) => x.itemId === item.id)) return p;
      const maxZ = p.reduce((m, x) => Math.max(m, x.z), 0);
      return [
        ...p,
        { itemId: item.id, x: 40 + (p.length % 3) * 70, y: 40 + (p.length % 4) * 60, scale: 1, z: maxZ + 1 },
      ];
    });
    setSelected(item.id);
  };

  const updatePlaced = (itemId: string, patch: Partial<Placed>) =>
    setPlaced((p) => p.map((x) => (x.itemId === itemId ? { ...x, ...patch } : x)));

  const removePlaced = (itemId: string) => {
    setPlaced((p) => p.filter((x) => x.itemId !== itemId));
    setSelected(null);
  };

  const bringFront = (itemId: string) => {
    const maxZ = placed.reduce((m, x) => Math.max(m, x.z), 0);
    updatePlaced(itemId, { z: maxZ + 1 });
  };

  const save = () => {
    if (placed.length < 2) {
      Alert.alert('Eksik kolaj', 'En az iki parça yerleştir.');
      return;
    }
    const layout: Record<string, { x: number; y: number; scale: number; z: number }> = {};
    for (const p of placed) layout[p.itemId] = { x: p.x, y: p.y, scale: p.scale, z: p.z };
    const itemIds = [...placed].sort((a, b) => a.z - b.z).map((p) => p.itemId);
    const canvasFrame =
      canvasSize.current.w > 0 ? { w: canvasSize.current.w, h: canvasSize.current.h } : undefined;
    if (editing) {
      updateOutfit(editing.id, { itemIds, layout, canvasFrame, cropToContent });
      router.back();
    } else {
      const o = addOutfit({
        name: `Kolaj ${outfits.length + 1}`,
        itemIds,
        layout,
        canvasFrame,
        cropToContent,
        favorite: false,
      });
      router.replace({ pathname: '/outfit/[id]', params: { id: o.id } });
    }
  };

  const selPlaced = placed.find((p) => p.itemId === selected);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.inkSoft} />
        </Pressable>
        <Text style={type.subtitle}>Canvas {editing ? `· ${editing.name}` : ''}</Text>
        <Button small title="💾 Kaydet" onPress={save} />
      </View>

      {/* Kırpma tercihi */}
      <View style={styles.cropRow}>
        <Chip
          label={cropToContent ? '✂️ İçeriğe kırp' : '🖼️ Tuvali koru (kırpma yok)'}
          active={cropToContent}
          color={colors.aqua}
          onPress={() => setCropToContent((v) => !v)}
        />
        <Text style={[type.tiny, { flex: 1 }]}>
          {cropToContent
            ? 'Parçalar kareye sığdırılır, boşluklar atılır.'
            : 'Tuvalde ne yaptıysan aynen kaydedilir.'}
        </Text>
      </View>

      {/* Kolaj alanı */}
      <View
        style={styles.canvas}
        onLayout={(e) => {
          canvasSize.current = {
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          };
        }}
      >
        {placed.length === 0 ? (
          <View style={styles.canvasHint}>
            <Text style={{ fontSize: 34 }}>🫧</Text>
            <Text style={[type.caption, { textAlign: 'center', maxWidth: 240 }]}>
              Alttaki şeritten parçalara dokunarak tuvale ekle, sonra sürükleyerek yerleştir.
            </Text>
          </View>
        ) : null}
        {[...placed]
          .sort((a, b) => a.z - b.z)
          .map((p) => {
            const item = items.find((i) => i.id === p.itemId);
            if (!item) return null;
            return (
              <DraggableGarment
                key={p.itemId}
                item={item}
                placed={p}
                selected={selected === p.itemId}
                onSelect={() => {
                  setSelected(p.itemId);
                  bringFront(p.itemId);
                }}
                onMoved={(x, y) => updatePlaced(p.itemId, { x, y })}
              />
            );
          })}
      </View>

      {/* Seçili parça araçları */}
      {selPlaced ? (
        <View style={styles.tools}>
          <Pressable
            onPress={() => updatePlaced(selPlaced.itemId, { scale: Math.max(0.5, selPlaced.scale - 0.15) })}
            style={styles.toolBtn}
          >
            <Ionicons name="remove" size={20} color={colors.ink} />
          </Pressable>
          <Pressable
            onPress={() => updatePlaced(selPlaced.itemId, { scale: Math.min(2.2, selPlaced.scale + 0.15) })}
            style={styles.toolBtn}
          >
            <Ionicons name="add" size={20} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => bringFront(selPlaced.itemId)} style={styles.toolBtn}>
            <Ionicons name="albums-outline" size={18} color={colors.ink} />
          </Pressable>
          <Pressable
            onPress={() => removePlaced(selPlaced.itemId)}
            style={[styles.toolBtn, { backgroundColor: colors.coralSoft }]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      ) : null}

      {/* Parça şeridi */}
      <View style={styles.strip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
          <Chip label="Hepsi" active={category === 'hepsi'} onPress={() => setCategory('hepsi')} />
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.label} emoji={c.emoji} active={category === c.id} onPress={() => setCategory(c.id)} />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, padding: spacing.md }}
        >
          {strip.map((i) => (
            <ItemThumb
              key={i.id}
              item={i}
              size={72}
              selected={placed.some((p) => p.itemId === i.id)}
              onPress={() => addToCanvas(i)}
            />
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function DraggableGarment({
  item,
  placed,
  selected,
  onSelect,
  onMoved,
}: {
  item: WardrobeItem;
  placed: Placed;
  selected: boolean;
  onSelect: () => void;
  onMoved: (x: number, y: number) => void;
}) {
  const pan = useRef(new Animated.ValueXY({ x: placed.x, y: placed.y })).current;
  const start = useRef({ x: placed.x, y: placed.y });

  // Parent state değişince (ör. yükleme) pozisyonu senkronla
  const lastProp = useRef({ x: placed.x, y: placed.y });
  if (lastProp.current.x !== placed.x || lastProp.current.y !== placed.y) {
    lastProp.current = { x: placed.x, y: placed.y };
    pan.setValue({ x: placed.x, y: placed.y });
  }

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          onSelect();
          start.current = { x: (pan.x as any)._value, y: (pan.y as any)._value };
        },
        onPanResponderMove: (_e, g) => {
          pan.setValue({ x: start.current.x + g.dx, y: start.current.y + g.dy });
        },
        onPanResponderRelease: (_e, g) => {
          const nx = Math.max(-30, start.current.x + g.dx);
          const ny = Math.max(-30, start.current.y + g.dy);
          lastProp.current = { x: nx, y: ny };
          pan.setValue({ x: nx, y: ny });
          onMoved(nx, ny);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelect, onMoved],
  );

  const size = BASE * placed.scale;
  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.placed,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
          width: size,
          height: size,
          borderColor: selected ? colors.aqua : 'transparent',
        },
      ]}
    >
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={{ width: '100%', height: '100%', borderRadius: radius.sm }} contentFit="contain" />
      ) : (
        <GarmentArt category={item.category} colorId={item.colorId} size={size * 0.94} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  canvas: {
    flex: 1,
    margin: spacing.md,
    marginTop: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  canvasHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  placed: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tools: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingBottom: spacing.sm,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: spacing.sm,
  },
});
