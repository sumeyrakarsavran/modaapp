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
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
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
  /** Derece cinsinden dönüş. Opsiyonel — eski kayıtlarda yok. */
  rot?: number;
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
        !title && { paddingHorizontal: 11 + BTN_PAD },
        pressed && { opacity: 0.82 },
        style,
      ]}
    >
      {/* Zemin elle kesilmiş siluet — düz köşe yarıçapı değil (bkz. FinBlob). */}
      <FinBlob
        variant="button"
        shadow={solid}
        pad={BTN_PAD}
        color={solid ? luxe.primary : glass.fill}
        stroke={solid ? undefined : luxe.outlineSoft}
      />
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
    const layout: Record<
      string,
      { x: number; y: number; scale: number; z: number; rot?: number }
    > = {};
    for (const p of placed) {
      // `rot` yalnızca varsa yazılıyor — döndürülmemiş parçalar eskisi gibi kalsın
      layout[p.itemId] = { x: p.x, y: p.y, scale: p.scale, z: p.z, ...(p.rot ? { rot: p.rot } : {}) };
    }
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

      {/* Kaydet solda, kapat sağda — kapat yanlışlıkla basılabilecek yerde durmasın */}
      <View style={styles.header}>
        <LuxeButton icon="bookmark-outline" title="Kaydet" onPress={save} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            Canvas
          </Text>
          {editing ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {editing.name}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={20} color={luxe.primary} />
        </Pressable>
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
                  onTransformed={(patch) => updatePlaced(p.itemId, patch)}
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

/** Ölçek sınırları — araç çubuğundaki +/- ile aynı aralık. */
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.2;
/**
 * Köşeden boyutlandırma hassasiyeti. Boy ORANSAL değişiyor: köşegen boyunca
 * `DRAG_K * ln2` kadar çekiş boyu iki katına çıkarır, aynı kadar geri çekiş
 * yarıya indirir — ileri ve geri simetrik.
 *
 * Değer CİHAZDA ÖLÇÜLEREK seçildi. Asıl sorun hassasiyet değil BİRİKME'ydi
 * (bkz. `busy` kilidi); o giderildikten sonra eğri ölçülüp buraya oturtuldu:
 * köşegende ~118dp (bu ekranda ~355 piksel) çekiş boyu iki katına çıkarıyor,
 * aynı kadar geri çekiş yarıya indiriyor.
 */
const DRAG_K = 170;
/**
 * Tutamaklar için parçanın çevresindeki GÖRÜNMEZ pay.
 *
 * ⚠️ Android, bir görünümün SINIRLARI DIŞINA taşan çocuklarına dokunuş
 * GÖNDERMİYOR. Tutamaklar `left: -14` gibi dışarıya konumlandığında ekranda
 * görünüyor ama basılamıyordu (telefonda görüldü: köşeden çekince hiçbir şey
 * olmuyor). Bu yüzden parça, kendisinden bu kadar büyük bir kutunun içine
 * ortalanıyor ve tutamaklar o kutunun İÇİNDE kalıyor. Pay yalnızca SEÇİLİYKEN
 * açılıyor; sürekli açık kalsa komşu parçaların dokunuşlarını çalardı.
 */
const HALO = 22;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Dik açılara yapıştır — elle tam düz durdurmak neredeyse imkânsız. */
const snapDeg = (deg: number) => {
  const q = Math.round(deg / 90) * 90;
  return Math.abs(deg - q) < 5 ? q : deg;
};

/**
 * Köşe tutamakları. `ax`/`ay` = ÇAPA: 1 ise o kenar sabit kalır, karşı köşe
 * hareket eder. Böylece sol üstten çekince parça sağ alta doğru büyümez,
 * gerçekten sol üste açılır.
 */
const CORNERS = [
  { key: 'tl', ax: 1, ay: 1, pos: { left: HALO - 17, top: HALO - 17 } },
  { key: 'tr', ax: 0, ay: 1, pos: { right: HALO - 17, top: HALO - 17 } },
  { key: 'bl', ax: 1, ay: 0, pos: { left: HALO - 17, bottom: HALO - 17 } },
  { key: 'br', ax: 0, ay: 0, pos: { right: HALO - 17, bottom: HALO - 17 } },
] as const;

function DraggableGarment({
  item,
  placed,
  selected,
  onSelect,
  onMoved,
  onTransformed,
}: {
  item: WardrobeItem;
  placed: Placed;
  selected: boolean;
  onSelect: () => void;
  onMoved: (x: number, y: number) => void;
  /** Boyut/dönüş hareket BİTİNCE tek seferde işlenir. */
  onTransformed: (patch: Partial<Placed>) => void;
}) {
  const pan = useRef(new Animated.ValueXY({ x: placed.x, y: placed.y })).current;
  const start = useRef({ x: placed.x, y: placed.y });

  /*
    ⚠️ PanResponder'lar BİR KEZ kuruluyor (`useMemo(..., [])`).
    Önce bağımlılık listesinde prop'lar vardı; üst bileşen her çizildiğinde
    (seçim, öne getirme, ölçek değişimi…) yeni PanResponder yaratılıyor ve
    görünüme YENİ bir `panHandlers` takılıyordu. Hareketin ortasında bu olunca
    yeni algılayıcının kendi `gestureState`'i sıfırdan başlıyor: `dx/dy`
    zıplıyor, parça uçuyor ya da köşeden çekmek işe yaramıyordu (telefonda
    görüldü). Güncel prop'lar bu yüzden ref'ten okunuyor.
  */
  const cur = useRef({ placed, onSelect, onMoved, onTransformed });
  cur.current = { placed, onSelect, onMoved, onTransformed };

  /*
    Boyut ve açı hareket SIRASINDA yerel durumda tutuluyor, bırakınca üst
    bileşene yazılıyor. Her karede store'a yazsaydık tuvaldeki bütün parçalar
    ve çekmece yeniden çizilirdi; sürükleme takılırdı.
  */
  const [live, setLive] = useState<{ scale: number; rot: number } | null>(null);
  const liveRef = useRef<{ scale: number; rot: number } | null>(null);
  const setLiveBoth = (v: { scale: number; rot: number } | null) => {
    liveRef.current = v;
    setLive(v);
  };
  const gs = useRef({ size: 0, x: 0, y: 0, rot: 0 });
  /** İki parmak hareketi başladıysa buraya yazılıyor. */
  const pinch = useRef<null | { dist: number; ang: number; scale: number; rot: number; x: number; y: number }>(null);

  /**
   * Bir hareket sürüyor mu?
   *
   * ⚠️ Bu kilit ŞART. Hareket sırasında görünümün boyu değişiyor, yani
   * parmağın altındaki hedef kayıyor; Android bu durumda dokunuşu yeniden
   * dağıtabiliyor ve `grab()` bir daha çalışıyordu. Başlangıç boyu o anki
   * (büyümüş) boya göre yeniden donunca `dx` hep baştan sayıldığı için etki
   * BİRİKİYORDU: küçük bir çekişte bile parça uçlara yapışıyordu (cihazda
   * ölçüldü — 30 piksellik çekiş 1.24 kat, 240 piksellik çekiş tavan).
   * Kilitle birlikte sonuç yalnızca (başlangıç hâli + toplam parmak yolu)
   * fonksiyonu oluyor.
   */
  const busy = useRef(false);

  /** Hareket başlarken parçanın o anki hâlini BİR KEZ dondur. */
  const grab = () => {
    const p = cur.current.placed;
    cur.current.onSelect();
    if (busy.current) return;
    busy.current = true;
    const x = (pan.x as any)._value;
    const y = (pan.y as any)._value;
    start.current = { x, y };
    gs.current = {
      size: BASE * (liveRef.current?.scale ?? p.scale),
      x,
      y,
      rot: liveRef.current?.rot ?? p.rot ?? 0,
    };
  };
  /** Hareket bitti — bir sonraki dokunuş yeniden dondurabilir. */
  const done = () => {
    busy.current = false;
  };

  // Parent state değişince (ör. yükleme) pozisyonu senkronla
  const lastProp = useRef({ x: placed.x, y: placed.y });
  if (lastProp.current.x !== placed.x || lastProp.current.y !== placed.y) {
    lastProp.current = { x: placed.x, y: placed.y };
    pan.setValue({ x: placed.x, y: placed.y });
  }

  /**
   * Parçanın kendi hareketi: TEK parmak taşır, İKİ parmak boyutlandırır ve
   * döndürür (kıstır → büyüt/küçült, çevir → döndür).
   *
   * İki parmaktan tek parmağa düşünce taşımaya DEVAM EDİLMİYOR: `gestureState`
   * mesafeyi ilk dokunuştan beri topladığı için parça zıplıyordu.
   */
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          pinch.current = null;
          grab();
        },
        onPanResponderTerminate: done,
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches;
          if (t.length >= 2) {
            const [a, b] = t;
            const dist = Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
            const ang = (Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX) * 180) / Math.PI;
            if (!pinch.current) {
              // İkinci parmak yeni değdi: ölçüm buradan başlasın
              pinch.current = {
                dist,
                ang,
                scale: gs.current.size / BASE,
                rot: gs.current.rot,
                x: (pan.x as any)._value,
                y: (pan.y as any)._value,
              };
              return;
            }
            const scale = clamp(
              pinch.current.scale * (dist / Math.max(1, pinch.current.dist)),
              MIN_SCALE,
              MAX_SCALE,
            );
            const rot = snapDeg(pinch.current.rot + (ang - pinch.current.ang));
            // Parça MERKEZİNDEN büyüsün: sol üst köşe farkın yarısı kadar kaysın
            const d = BASE * scale - BASE * pinch.current.scale;
            pan.setValue({ x: pinch.current.x - d / 2, y: pinch.current.y - d / 2 });
            setLiveBoth({ scale, rot });
            return;
          }
          if (pinch.current) return;
          pan.setValue({ x: start.current.x + g.dx, y: start.current.y + g.dy });
        },
        onPanResponderRelease: (_e, g) => {
          if (pinch.current) {
            const nx = (pan.x as any)._value;
            const ny = (pan.y as any)._value;
            const l = liveRef.current;
            lastProp.current = { x: nx, y: ny };
            pinch.current = null;
            setLiveBoth(null);
            done();
            cur.current.onTransformed({
              x: nx,
              y: ny,
              scale: l?.scale ?? cur.current.placed.scale,
              rot: l?.rot ?? cur.current.placed.rot ?? 0,
            });
            return;
          }
          const nx = Math.max(-30, start.current.x + g.dx);
          const ny = Math.max(-30, start.current.y + g.dy);
          lastProp.current = { x: nx, y: ny };
          pan.setValue({ x: nx, y: ny });
          done();
          cur.current.onMoved(nx, ny);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Dört köşe: aynı mantık, çapaları farklı. */
  const cornerResponders = useMemo(
    () =>
      CORNERS.map(({ ax, ay }) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: grab,
          onPanResponderTerminate: done,
          onPanResponderMove: (_e, g) => {
            /*
              ⚠️ Parmağın hareketi EKRAN eksenlerinde geliyor, köşeler ise
              parçanın KENDİ ekseninde. Parça döndürülmüşse ikisi uyuşmuyor:
              90° dönük bir parçada sağa çekmek aslında "aşağı" demek oluyordu
              ve boyut fırlayıp en küçüğe/en büyüğe yapışıyordu (telefonda
              görüldü: "parmağımı bırakınca fazla büyüyüp küçülüyor").
              Önce hareketi parçanın eksenine çeviriyoruz.
            */
            const r = (gs.current.rot * Math.PI) / 180;
            const cos = Math.cos(r);
            const sin = Math.sin(r);
            const lx = g.dx * cos + g.dy * sin;
            const ly = -g.dx * sin + g.dy * cos;
            // Sol/üst tutamaklarda yön ters: sola çekmek BÜYÜTÜR.
            const sx = ax ? -1 : 1;
            const sy = ay ? -1 : 1;
            /*
              Boyut ORANSAL değişiyor (üstel), toplamsal değil.
              Toplamsalken küçülme ile büyüme simetrik değildi: taban boy 110
              olduğu için en küçüğe inmek 55'lik bir çekiş yetiyor, en büyüğe
              çıkmak 132 istiyordu — parça bir anda dibe vuruyor ya da fırlıyordu
              ("çok küçülüyor ya da çok büyüyor"). Üstel eşlemede ileri ve geri
              aynı mesafeyi istiyor: DRAG_K kadar çekiş boyu iki katına çıkarır,
              aynı kadar geri çekiş yarıya indirir.
            */
            const next = clamp(
              (gs.current.size / BASE) * Math.exp((sx * lx + sy * ly) / 2 / DRAG_K),
              MIN_SCALE,
              MAX_SCALE,
            );
            const d = BASE * next - gs.current.size;
            /*
              Çapa köşesi ekranda yerinde kalsın. Dönüş MERKEZ etrafında
              olduğu için hesap merkez üzerinden yürüyor: çapadan merkeze
              bakan yerel kayma bulunuyor, ekrana döndürülüyor, yeni sol üst
              köşe merkezden geri çıkarılıyor.
            */
            const cx0 = gs.current.x + gs.current.size / 2;
            const cy0 = gs.current.y + gs.current.size / 2;
            const mx = (0.5 - ax) * d;
            const my = (0.5 - ay) * d;
            const cx = cx0 + (mx * cos - my * sin);
            const cy = cy0 + (mx * sin + my * cos);
            pan.setValue({ x: cx - (BASE * next) / 2, y: cy - (BASE * next) / 2 });
            setLiveBoth({ scale: next, rot: gs.current.rot });
          },
          onPanResponderRelease: () => {
            const nx = (pan.x as any)._value;
            const ny = (pan.y as any)._value;
            const scale = liveRef.current?.scale ?? cur.current.placed.scale;
            lastProp.current = { x: nx, y: ny };
            setLiveBoth(null);
            done();
            cur.current.onTransformed({ x: nx, y: ny, scale });
          },
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Döndürme tutamağı — parçanın alt kenarına asılı. Açı, merkezden tutamağa
   * giden vektörün dönüşünden hesaplanıyor: parmağın nereye gittiği değil,
   * merkez etrafında ne kadar döndüğü önemli.
   */
  const rotateResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: grab,
        onPanResponderTerminate: done,
        onPanResponderMove: (_e, g) => {
          /*
            Tutamak parçanın YEREL olarak altında duruyor; parça dönükse
            ekrandaki yeri de dönmüş oluyor. Başlangıç vektörü bu yüzden
            döndürülerek hesaplanıyor, yoksa her dokunuşta açı sıçrıyordu.
          */
          const arm = gs.current.size / 2 + HALO;
          const r = (gs.current.rot * Math.PI) / 180;
          const v0x = -arm * Math.sin(r);
          const v0y = arm * Math.cos(r);
          const a0 = Math.atan2(v0y, v0x);
          const a1 = Math.atan2(v0y + g.dy, v0x + g.dx);
          const deg = snapDeg(gs.current.rot + ((a1 - a0) * 180) / Math.PI);
          setLiveBoth({ scale: gs.current.size / BASE, rot: deg });
        },
        onPanResponderRelease: () => {
          const rot = liveRef.current?.rot ?? cur.current.placed.rot ?? 0;
          setLiveBoth(null);
          done();
          cur.current.onTransformed({ rot });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const scale = live ? live.scale : placed.scale;
  const rot = live ? live.rot : placed.rot ?? 0;
  const size = BASE * scale;
  // Pay yalnızca seçiliyken; kutu büyüse de parça yerinde kalsın diye
  // sol/üst aynı miktarda negatife çekiliyor.
  const halo = selected ? HALO : 0;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{
        position: 'absolute',
        left: -halo,
        top: -halo,
        width: size + halo * 2,
        height: size + halo * 2,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: `${rot}deg` }],
      }}
    >
      <View
        style={[
          styles.placed,
          { width: size, height: size, borderColor: selected ? luxe.primary : 'transparent' },
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
      </View>

      {selected ? (
        <>
          {/* Köşeler: tut ve çek → boyutlanır. Görünen kare küçük, dokunma
              alanı geniş; yoksa parmakla tutturmak imkânsız oluyor. */}
          {CORNERS.map((c, i) => (
            <View key={c.key} {...cornerResponders[i].panHandlers} style={[styles.handleHit, c.pos]}>
              <View style={styles.handleDot} />
            </View>
          ))}
          {/* Alt kenara asılı tutamak: merkez etrafında döndürür */}
          <View {...rotateResponder.panHandlers} style={styles.rotHit}>
            <View style={styles.rotKnob}>
              <Ionicons name="refresh" size={12} color={luxe.primary} />
            </View>
          </View>
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
    paddingVertical: 10 + BTN_PAD,
    paddingHorizontal: 15 + BTN_PAD,
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
  /** Parçanın kendi kutusu — seçim çerçevesi buna oturuyor (pay dışarıda). */
  placed: {
    borderWidth: 1.5,
    borderRadius: luxeRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  /** Köşe tutamağının DOKUNMA alanı — görünenden çok daha geniş. */
  handleHit: { position: 'absolute', width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  handleDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: luxe.surface,
    borderWidth: 1.5,
    borderColor: luxe.primary,
  },
  /** Döndürme tutamağı: parçanın alt kenarına asılı, payın İÇİNDE. */
  rotHit: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: 44,
    height: 34,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  rotKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: luxe.surface,
    borderWidth: 1.5,
    borderColor: luxe.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
