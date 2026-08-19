import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { GarmentArt } from '@/components/GarmentArt';
import { ItemThumb } from '@/components/ItemThumb';
import { CANVAS_BASE } from '@/components/OutfitCollage';
import { useStore } from '@/store/useStore';
import { font, glass, iridescent, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
import { CATEGORIES, type Category, type WardrobeItem } from '@/types';

interface Placed {
  itemId: string;
  x: number;
  y: number;
  scale: number;
  z: number;
}

const BASE = CANVAS_BASE; // yerleştirilen parçanın taban boyutu (önizlemeyle ortak)

/**
 * Parça çekmecesinin kapalı yüksekliği (güvenli alan HARİÇ).
 * Tutamak + başlık + kategori hapları + tek sıra karo tam sığsın diye
 * ölçülerek belirlendi; kısa tutulunca karoların altı kırpılıyordu.
 */
const DRAWER_CLOSED = 164;
/** Izgaradaki parça karosunun EN KÜÇÜK boyu — sütun sayısı buna göre. */
const CELL = 76;
const CELL_GAP = 10;

/** Editoryal düğme — Stüdyo ve Gardırop'takiyle aynı. */
function LuxeButton({
  title,
  onPress,
  icon,
  variant = 'solid',
  style,
}: {
  title?: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  variant?: 'solid' | 'outline';
  style?: any;
}) {
  const solid = variant === 'solid';
  const fg = solid ? luxe.onPrimary : luxe.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.lxBtn,
        solid
          ? { backgroundColor: luxe.primary }
          : { backgroundColor: glass.fill, borderWidth: 1, borderColor: luxe.outlineSoft },
        !title && { paddingHorizontal: 11 },
        pressed && { opacity: 0.82 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      {title ? <Text style={[styles.lxBtnText, { color: fg }]}>{title}</Text> : null}
    </Pressable>
  );
}

export default function Canvas() {
  const { outfitId } = useLocalSearchParams<{ outfitId?: string }>();
  const { items, outfits, addOutfit, updateOutfit } = useStore();
  const { width, height } = useWindowDimensions();
  /*
    Alt güvenli alan ELLE ekleniyor. `SafeAreaView edges={['bottom']}` bu
    cihazda üç tuşlu gezinme çubuğunun tamamını karşılamıyordu (telefonda
    görüldü: karoların altı çubuğun arkasında kalıyor). Çekmece mutlak
    konumlu olduğu için kendi boşluğunu kendi vermeli.
  */
  const insets = useSafeAreaInsets();
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
  /**
   * Parça çekmecesi açık mı?
   * Kapalıyken tek sıra yatay şerit (hızlı erişim), açıkken DİKEY kaydırılan
   * ızgara — çok kıyafeti olan biri yatay şeritte onlarca parçayı sürükleyerek
   * arıyordu. Çekmece tuvalin ÜSTÜNE biniyor, tuvali küçültmüyor: yükseklik
   * değişse `canvasFrame` de değişir ve kaydedilen kadraj kayardı.
   */
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Kırpma tercihi: kapalı = tuval çerçevesi aynen korunur (WYSIWYG)
  const [cropToContent, setCropToContent] = useState<boolean>(editing?.cropToContent ?? false);
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const active = items.filter((i) => !i.archived);
  const strip = category === 'hepsi' ? active : active.filter((i) => i.category === category);

  /** Açık çekmecenin yüksekliği — ekranın yarısını geçmesin, tuval görünür kalsın. */
  const drawerH = drawerOpen ? Math.min(420, Math.round(height * 0.52)) : DRAWER_CLOSED;
  /** Satıra kaç karo sığıyor — FlatList sütun sayısını bilmek zorunda. */
  const cols = Math.max(3, Math.floor((width - 32 + CELL_GAP) / (CELL + CELL_GAP)));
  /*
    Karo boyu satırı TAM dolduracak şekilde büyütülüyor. Sabit 76 bırakılınca
    sağda bir sütunluk boşluk kalıyor ve ızgara yarım görünüyordu.
  */
  const gridCell = Math.floor((width - 32 - CELL_GAP * (cols - 1)) / cols);

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

  /**
   * Çekmece başlığının sürükleme algısı.
   * Yalnızca BAŞLIĞA bağlı — ızgaranın üstüne konsaydı parçaları kaydırmayı
   * yutardı. Yukarı çek → aç, aşağı çek → kapat, kısa dokunuş → çevir.
   */
  const headDrag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -16) setDrawerOpen(true);
          else if (g.dy > 16) setDrawerOpen(false);
          else setDrawerOpen((v) => !v);
        },
      }),
    [],
  );

  const garmentTile = (i: WardrobeItem, size: number) => (
    <ItemThumb
      key={i.id}
      item={i}
      size={size}
      selected={placed.some((p) => p.itemId === i.id)}
      onPress={() => addToCanvas(i)}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Canvas</Text>
          {editing ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {editing.name}
            </Text>
          ) : null}
        </View>
        <LuxeButton icon="bookmark-outline" title="Kaydet" onPress={save} />
      </View>

      {/* Kırpma tercihi — kaydederken kadrajın ne olacağını belirliyor */}
      <View style={styles.cropRow}>
        <Pressable
          onPress={() => setCropToContent((v) => !v)}
          style={({ pressed }) => [styles.cropPill, pressed && { opacity: 0.85 }]}
        >
          {cropToContent ? (
            <LinearGradient
              colors={iridescent.soft}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cropFill}
              pointerEvents="none"
            />
          ) : null}
          <Ionicons
            name={cropToContent ? 'crop' : 'scan-outline'}
            size={13}
            color={cropToContent ? luxe.primary : luxe.outline}
          />
          <Text style={[styles.cropText, cropToContent && { color: luxe.primary }]}>
            {cropToContent ? 'İçeriğe kırp' : 'Tuvali koru'}
          </Text>
        </Pressable>
        <Text style={[luxeType.tiny, { flex: 1 }]}>
          {cropToContent ? 'Boşluklar atılır.' : 'Tuvaldeki kadraj aynen kaydedilir.'}
        </Text>
      </View>

      {/* ————— Tuval ————— */}
      <View style={[styles.sheetWrap, { marginBottom: DRAWER_CLOSED + insets.bottom }]}>
        <View
          style={styles.sheet}
          onLayout={(e) => {
            canvasSize.current = {
              w: e.nativeEvent.layout.width,
              h: e.nativeEvent.layout.height,
            };
          }}
        >
          {/*
            Tasarım masası işaretleri: orta kılavuzlar ve köşe kesim payları.
            Çok soluk — hizalamaya yardım etsin, kompozisyonun önüne geçmesin.
          */}
          <View style={styles.guideV} pointerEvents="none" />
          <View style={styles.guideH} pointerEvents="none" />
          <View style={[styles.tick, styles.tickTL]} pointerEvents="none" />
          <View style={[styles.tick, styles.tickTR]} pointerEvents="none" />
          <View style={[styles.tick, styles.tickBL]} pointerEvents="none" />
          <View style={[styles.tick, styles.tickBR]} pointerEvents="none" />

          {placed.length === 0 ? (
            <View style={styles.canvasHint} pointerEvents="none">
              <Ionicons name="hand-left-outline" size={26} color={luxe.outlineSoft} />
              <Text style={[luxeType.caption, { textAlign: 'center', maxWidth: 250 }]}>
                Aşağıdaki parçalara dokunarak tuvale ekle, sonra sürükleyerek yerleştir.
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
      </View>

      {/* Seçili parçanın yüzen araç çubuğu — tuvalin üstünde, çekmecenin hemen üstünde */}
      {selPlaced ? (
        <View style={[styles.tools, { bottom: drawerH + insets.bottom + 12 }]} pointerEvents="box-none">
          <View style={styles.toolBar}>
            <Pressable
              onPress={() =>
                updatePlaced(selPlaced.itemId, { scale: Math.max(0.5, selPlaced.scale - 0.15) })
              }
              style={styles.toolBtn}
            >
              <Ionicons name="remove" size={19} color={luxe.ink} />
            </Pressable>
            <Pressable
              onPress={() =>
                updatePlaced(selPlaced.itemId, { scale: Math.min(2.2, selPlaced.scale + 0.15) })
              }
              style={styles.toolBtn}
            >
              <Ionicons name="add" size={19} color={luxe.ink} />
            </Pressable>
            <View style={styles.toolSep} />
            <Pressable onPress={() => bringFront(selPlaced.itemId)} style={styles.toolBtn}>
              <Ionicons name="layers-outline" size={17} color={luxe.ink} />
            </Pressable>
            <Pressable onPress={() => removePlaced(selPlaced.itemId)} style={styles.toolBtn}>
              <Ionicons name="trash-outline" size={17} color={luxe.danger} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ————— Parça çekmecesi ————— */}
      <View style={[styles.drawer, { height: drawerH + insets.bottom, paddingBottom: insets.bottom }]}>
        {/*
          Başlık hem DOKUNUŞA hem SÜRÜKLEMEYE cevap veriyor: düğmeye basmak
          zorunda kalmadan tutamağı yukarı çekip çekmeceyi açabilmek gerekiyor
          (aşağı çekmek kapatıyor). Küçük hareket dokunuş sayılıp durumu
          çeviriyor.
        */}
        <View {...headDrag.panHandlers} style={styles.drawerHead}>
          <View style={styles.grabber} />
          <View style={styles.drawerHeadRow}>
            <Text style={styles.drawerTitle}>Parçalar</Text>
            <Text style={styles.drawerCount}>{strip.length}</Text>
            <View style={{ flex: 1 }} />
            <Ionicons
              name={drawerOpen ? 'chevron-down' : 'chevron-up'}
              size={16}
              color={luxe.outline}
            />
          </View>
        </View>

        {/* Kategori süzgeci */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catBar}
          contentContainerStyle={{ gap: 7, paddingHorizontal: 16 }}
        >
          <CatPill label="Hepsi" active={category === 'hepsi'} onPress={() => setCategory('hepsi')} />
          {CATEGORIES.map((c) => (
            <CatPill
              key={c.id}
              label={c.label}
              active={category === c.id}
              onPress={() => setCategory(c.id)}
            />
          ))}
        </ScrollView>

        {/*
          Kapalı: tek sıra yatay şerit. Açık: DİKEY kaydırılan ızgara —
          gardırobu kalabalık olan tüm parçalarını görebilsin.
        */}
        {drawerOpen ? (
          /*
            ⚠️ Burada `flexWrap`'li bir ScrollView VARDI ve iki şeyi birden
            yanlış yapıyordu (telefonda görüldü): sığabilecekken satıra 4 değil
            3 karo koyuyor, ve bir kez dibe inince YUKARI KAYDIRILAMIYORDU —
            sarmalanan satırların yüksekliğini ScrollView doğru ölçemiyor.
            FlatList sütun sayısını kendisi biliyor, kaydırması güvenilir ve
            kalabalık gardıropta yalnızca görünen karoları çiziyor.
          */
          <FlatList
            style={{ flex: 1 }}
            data={strip}
            key={`g${cols}`}
            numColumns={cols}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => garmentTile(item, gridCell)}
            columnWrapperStyle={cols > 1 ? { gap: CELL_GAP } : undefined}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator
            ListEmptyComponent={
              <Text style={[luxeType.caption, { padding: 8 }]}>Bu kategoride parça yok.</Text>
            }
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: CELL_GAP, paddingHorizontal: 16, paddingTop: 8 }}
          >
            {strip.length ? (
              strip.map((i) => garmentTile(i, CELL))
            ) : (
              <Text style={[luxeType.caption, { paddingVertical: 24 }]}>
                Bu kategoride parça yok.
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

/** Kategori hapı — seçiliyken pastel iridesan dolgu. */
function CatPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}>
      {active ? (
        <LinearGradient
          colors={iridescent.soft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pillFill}
          pointerEvents="none"
        />
      ) : null}
      <Text style={[styles.pillText, active && { color: luxe.primary }]}>{label}</Text>
    </Pressable>
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
          borderColor: selected ? luxe.primary : 'transparent',
        },
      ]}
    >
      {item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          style={{ width: '100%', height: '100%', borderRadius: luxeRadius.sm }}
          contentFit="contain"
        />
      ) : (
        <GarmentArt
          category={item.category}
          subcategory={item.subcategory}
          colorId={item.colorId}
          size={size * 0.94}
        />
      )}
      {/* Seçili parçanın köşe tutamakları — düzenlendiği belli olsun */}
      {selected ? (
        <>
          <View style={[styles.handle, { left: -4, top: -4 }]} pointerEvents="none" />
          <View style={[styles.handle, { right: -4, top: -4 }]} pointerEvents="none" />
          <View style={[styles.handle, { left: -4, bottom: -4 }]} pointerEvents="none" />
          <View style={[styles.handle, { right: -4, bottom: -4 }]} pointerEvents="none" />
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  title: { fontFamily: font.display, fontSize: 24, lineHeight: 30, color: luxe.primary },
  subtitle: {
    fontFamily: font.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: luxe.outline,
    marginTop: -2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: luxeRadius.pill,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  lxBtnText: {
    fontFamily: font.label,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  cropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  cropPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    backgroundColor: glass.fill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  cropFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  cropText: { fontFamily: font.bodyMedium, fontSize: 11.5, color: luxe.outline },

  // ————— Tuval —————
  sheetWrap: { flex: 1, paddingHorizontal: 16, paddingBottom: 4 },
  /** Beyaz sayfa: masaya konmuş bir tabaka gibi — gölge hiyerarşinin tepesinde. */
  sheet: {
    flex: 1,
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.lg,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    overflow: 'hidden',
    ...luxeShadow.card,
  },
  /** Orta kılavuzlar — kompozisyonu ortalamak için, neredeyse görünmez. */
  guideV: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(23,23,26,0.05)' },
  guideH: { position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(23,23,26,0.05)' },
  /** Köşe kesim payı işaretleri — tasarım masası dili. */
  tick: { position: 'absolute', width: 14, height: 14, borderColor: luxe.outlineSoft },
  tickTL: { left: 10, top: 10, borderLeftWidth: 1, borderTopWidth: 1 },
  tickTR: { right: 10, top: 10, borderRightWidth: 1, borderTopWidth: 1 },
  tickBL: { left: 10, bottom: 10, borderLeftWidth: 1, borderBottomWidth: 1 },
  tickBR: { right: 10, bottom: 10, borderRightWidth: 1, borderBottomWidth: 1 },
  canvasHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  placed: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: luxeRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  /** Seçili parçanın köşe tutamağı. */
  handle: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 2,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.primary,
  },

  // ————— Araç çubuğu —————
  tools: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 5,
    borderRadius: luxeRadius.pill,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    ...luxeShadow.hero,
  },
  toolBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  toolSep: { width: 1, height: 20, backgroundColor: luxe.outlineSoft, marginHorizontal: 2 },

  // ————— Çekmece —————
  /*
    ⚠️ `elevation` ŞART, süs değil. Android'de yüksek elevation'lı bir kardeş,
    hiyerarşide SONRA gelen kardeşin dokunuşlarını da çalıyor: tuval tabakası
    (elevation 10) açık çekmecenin ÜST yarısıyla çakışıyor ve orada başlayan
    kaydırmaları yutuyordu. Belirti tam da buydu — liste aşağı iniyor ama
    sonuna gelince yukarı dönmüyordu, çünkü geri dönüş hareketi listenin
    üst kısmından başlıyor. Çekmece tabakadan yüksek olmalı.
  */
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: luxe.surface,
    borderTopWidth: 1,
    borderTopColor: luxe.outlineSoft,
    borderTopLeftRadius: luxeRadius.lg,
    borderTopRightRadius: luxeRadius.lg,
    shadowColor: '#4A2F33',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 24,
  },
  drawerHead: { paddingTop: 7, paddingBottom: 2 },
  /** Tutamak — çekmecenin açılabildiğini gösteren tek işaret. */
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: luxe.outlineSoft,
  },
  drawerHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    paddingHorizontal: 16,
    paddingTop: 7,
    paddingBottom: 6,
  },
  drawerTitle: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.primary,
  },
  drawerCount: { fontFamily: font.body, fontSize: 11, color: luxe.outline },
  catBar: { flexGrow: 0, flexShrink: 0, marginBottom: 2 },
  pill: {
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    paddingVertical: 6,
    paddingHorizontal: 13,
    overflow: 'hidden',
  },
  pillFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  pillText: { fontFamily: font.bodyMedium, fontSize: 12, color: luxe.outline },
  /** FlatList içerik kabı — satır arası boşluk `gap`, satır içi `columnWrapperStyle`. */
  grid: {
    gap: CELL_GAP,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
});
