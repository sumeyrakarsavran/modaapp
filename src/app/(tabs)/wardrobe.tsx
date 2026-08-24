import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { ConfirmModal } from '@/components/ConfirmModal';
import { GarmentArt } from '@/components/GarmentArt';
import { LOOKBOOK_ICONS, LookbookIcon } from '@/components/LookbookIcon';
import { OutfitCollage } from '@/components/OutfitCollage';
import { Reorderable } from '@/components/Reorderable';
import { ShareModal } from '@/components/ShareModal';
import { resizeForProcessing } from '@/services/imageResize';
import { photoFromParams, pickPhoto, type PickedPhoto } from '@/services/photoPicker';
import { persistGarmentPhoto } from '@/services/photoStore';
import { useStore } from '@/store/useStore';
import { font, glass, iridescent, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
import {
  CATEGORIES,
  ITEM_COLORS,
  subcategoriesOf,
  todayISO,
  type Category,
  type Selfie,
  type WardrobeItem,
} from '@/types';

type Section = 'parcalar' | 'kombinler' | 'selfiler' | 'lookbooklar';


/** Askıdaki kartın ölçüsü; raf yüksekliği buna göre hesaplanıyor. */
const CARD_W = 98;
/** Lookbook satırının SABİT yüksekliği — sürükle-bırak yuva hesabı buna dayanıyor. */
const LB_ROW_H = 104;
const CARD_IMG_H = Math.round((CARD_W * 4) / 3);
/** Askı kancasının yüksekliği — boru bu hizada geçiyor. */
const HOOK_H = 22;

const colorLabel = (id: string) => ITEM_COLORS.find((c) => c.id === id)?.label ?? '';

/**
 * Fotoğraf + yer tutucu.
 * Kayıtlı dosya silinmişse `Image` HİÇBİR ŞEY çizmiyor ve ekranda bomboş bir
 * delik kalıyordu (cihazda görüldü: 5 selfie'nin 4'ü boş). Arkaya nötr bir
 * kutu ve ikon konuyor; görsel yüklenirse onun üstünü kapatıyor.
 */
function Photo({
  uri,
  style,
  icon = 'image-outline',
}: {
  uri: string;
  style: any;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={[style, styles.photoWrap]}>
      <Ionicons name={icon} size={22} color={luxe.outlineSoft} />
      <Image
        source={{ uri }}
        style={[style, { position: 'absolute', left: 0, top: 0 }]}
        contentFit="cover"
      />
    </View>
  );
}

/** "2026-08-04" → "4 Ağustos". Ham ISO tarih arayüzde ham duruyordu. */
const prettyDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

/**
 * Askıdaki tek parça.
 *
 * Örnekteki `hanger:hover` davranışının dokunmatik karşılığı: basılınca askı
 * hafifçe aşağı süzülüp yana yatıyor, bırakınca yaylanarak yerine dönüyor.
 * RN'in kendi `Animated`'ı kullanılıyor — Reanimated'ın babel eklentisi bu
 * projede kurulu değil, `withSpring` sessizce çalışmazdı.
 */
const Hanger = React.memo(function Hanger({
  item,
  onPress,
  dragging,
  shelf,
}: {
  item: WardrobeItem;
  onPress: () => void;
  dragging?: boolean;
  /**
   * RAF kipi: kanca ve kart çerçevesi yok — parça doğrudan rafın üstünde
   * duruyor. Ayakkabı ve aksesuar asılmaz; onlar için askı yerine raf.
   */
  shelf?: boolean;
}) {
  const swing = useRef(new Animated.Value(0)).current;
  const to = (v: number) =>
    Animated.spring(swing, {
      toValue: v,
      useNativeDriver: true,
      friction: 5,
      tension: 90,
    }).start();

  return (
    <Animated.View
      style={{
        transform: [
          { translateY: swing.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
          { rotate: swing.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '2.5deg'] }) },
          // Sürüklenen askı hafifçe büyüyor — hangisi elimde belli olsun
          { scale: dragging ? 1.06 : 1 },
        ],
      }}
    >
      <Pressable onPressIn={() => to(1)} onPressOut={() => to(0)} onPress={onPress}>
        {/* Kanca yalnızca askı kipinde */}
        {shelf ? null : <View style={styles.hook} />}
        <View style={shelf ? styles.shelfItem : styles.card}>
          <View style={shelf ? styles.shelfImg : styles.cardImg}>
            {item.imageUri ? (
              /*
                Gerçek kıyafet fotoğrafları HER ZAMAN `contain`: arka planı
                silinmiş uzun/dar parçaları (elbise, palto) `cover` kırpıyor.
              */
              <Image
                source={{ uri: item.imageUri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            ) : (
              <GarmentArt
                category={item.category}
                subcategory={item.subcategory}
                colorId={item.colorId}
                size={CARD_W * 0.62}
              />
            )}
            {item.favorite ? (
              <View style={styles.favDot}>
                <Ionicons name="heart" size={10} color={luxe.ink} />
              </View>
            ) : null}
          </View>
          <View style={shelf ? styles.shelfMeta : styles.cardMeta}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardColor} numberOfLines={1}>
              {colorLabel(item.colorId)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

/*
  `React.memo`: raf sıralanırken listedeki bütün askılar yeniden çiziliyordu —
  her biri bir fotoğraf taşıdığı için sürükleme takılıyordu. Artık yalnızca
  değişen askı çiziliyor.
*/
/** Askıdaki parçanın toplam yüksekliği — sürükle-bırak yuva hesabı için. */
const HANGER_H = HOOK_H + CARD_IMG_H + 40;
/** Bir rafa en fazla bu kadar parça sığıyor; fazlası alt rafa iner. */
const RACK_MAX = 10;
/** Kartlar 8px üst üste biniyor (askılık hissi) — yuva adımı da o kadar dar. */
const RACK_GAP = -8;
const RACK_STEP = CARD_W + RACK_GAP;
/** Sürüklerken rafın kendiliğinden kaymaya başladığı kenar payı (px). */
const EDGE = 64;
/**
 * Raf kipinde parçanın yüksekliği — kanca yok, meta çizginin altında.
 * Görsel alanı askıdakinden YÜKSEK: arkasında beyaz kutu olmadığı için parça
 * doğrudan rafın üstünde duruyor ve daha büyük görünebiliyor.
 */
const SHELF_IMG_H = CARD_IMG_H + 14;
const SHELF_H = SHELF_IMG_H + 42;
/** `styles.rack` dolgularıyla birlikte bir rafın toplam yüksekliği. */
const RACK_PAD_T = 19;
const RACK_PAD_B = 14;
const RACK_PAD_L = 20;
const ROW_H = RACK_PAD_T + HANGER_H + RACK_PAD_B;
const SHELF_ROW_H = RACK_PAD_T + SHELF_H + RACK_PAD_B;

/**
 * Bir kategorinin askılığı: başlık + raflar.
 *
 * Parçalar basılı tutulup sürüklenerek sıralanıyor — kendi KATEGORİSİ içinde,
 * ama raflar arası da serbest: alttaki rafa taşınabiliyor.
 *
 * ⚠️ Her raf KENDİ yatay ScrollView'ında (biri kayınca hepsi kaymasın diye),
 * bu yüzden sürükleme raf düzeyinde: sürüklenen parça rafın dışında, rafların
 * ÜSTÜNDE yüzen bir kopya olarak çiziliyor. Hedef yuva hesaplanırken her rafın
 * kendi kaydırma konumu (`scrollX`) hesaba katılıyor — yoksa kaydırılmış bir
 * rafta parça yanlış yere düşüyor.
 */
function Rack({
  title,
  items,
  onOpen,
  onReorder,
  maxPerRow,
  shelf,
}: {
  title: string;
  items: WardrobeItem[];
  onOpen: (id: string) => void;
  onReorder: (ids: string[]) => void;
  /** Bir rafa en fazla kaç parça. Verilmezse hepsi tek rafta. */
  maxPerRow?: number;
  /** Askı yerine RAF: kanca ve kart yok, çizgi parçaların ALTINDA. */
  shelf?: boolean;
}) {
  const per = maxPerRow ?? Math.max(1, items.length);
  const cellH = shelf ? SHELF_H : HANGER_H;
  const rowH = shelf ? SHELF_ROW_H : ROW_H;

  /** Ekrandaki sıra — sürükleme boyunca yerel, bırakınca üste bildiriliyor. */
  const [order, setOrder] = useState<WardrobeItem[]>(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);
  useEffect(() => {
    // Sürükleme sürerken dışarıdan gelen listeyle ezme — karo zıplar
    if (dragRef.current) return;
    setOrder(items);
  }, [items]);

  const rows: WardrobeItem[][] = [];
  for (let i = 0; i < order.length; i += per) rows.push(order.slice(i, i + per));

  const scrollX = useRef<number[]>([]);
  /** Otomatik kaydırma için rafların kendisi. */
  const scrollRefs = useRef<(ScrollView | null)[]>([]);
  const autoDir = useRef(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const { width } = useWindowDimensions();

  /*
    Karolar rafın İÇİNDE mutlak konumlu ve her biri kendi Animated değerine
    sahip: sıra değişince yerlerine YAYLANARAK gidiyorlar. Düz flex dizilimde
    her değişiklik sert bir sıçrama oluyordu — "çok manuel duruyor" tam olarak
    buydu. Animasyon `transform` üzerinden, yani native sürücüyle.
  */
  const posRef = useRef(new Map<string, Animated.ValueXY>());
  const posOf = (id: string, col: number) => {
    let v = posRef.current.get(id);
    if (!v) {
      v = new Animated.ValueXY({ x: col * RACK_STEP, y: 0 });
      posRef.current.set(id, v);
    }
    return v;
  };
  const startPos = useRef({ x: 0, y: 0 });
  /** Parmağın en son bıraktığı konum — karo oradan yuvasına yaylanıyor. */
  const lastPan = useRef({ x: 0, y: 0 });
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Sabit algılayıcı içinden okunacak güncel değerler. */
  const cur = useRef({ order, per, onReorder });
  cur.current = { order, per, onReorder };

  /** Bir parçanın rafındaki YEREL konumu (kaydırma düşülmüş). */
  const localPos = (index: number) => {
    const row = Math.floor(index / cur.current.per);
    const col = index % cur.current.per;
    return {
      x: RACK_PAD_L + col * RACK_STEP - (scrollX.current[row] ?? 0),
      y: row * rowH + RACK_PAD_T,
    };
  };

  /** Kartın MERKEZİ hangi yuvanın üstündeyse sırayı ona göre günceller. */
  const applyTarget = () => {
    const c = cur.current;
    const key = dragRef.current;
    if (!key) return;
    const cx = lastPan.current.x + CARD_W / 2;
    const cy = lastPan.current.y + cellH / 2;
    const rowCount = Math.ceil(c.order.length / c.per);
    const row = Math.max(0, Math.min(rowCount - 1, Math.floor(cy / rowH)));
    const inRow = Math.min(c.per, c.order.length - row * c.per);
    const col = Math.max(
      0,
      Math.min(
        inRow - 1,
        Math.round((cx - RACK_PAD_L - CARD_W / 2 + (scrollX.current[row] ?? 0)) / RACK_STEP),
      ),
    );
    const target = Math.max(0, Math.min(c.order.length - 1, row * c.per + col));
    const from = c.order.findIndex((it) => it.id === key);
    if (from >= 0 && target !== from) {
      const next = [...c.order];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      setOrder(next);
    }
  };

  /*
    KENARDA OTOMATİK KAYDIRMA. Sürükleme sırasında rafın kendi kaydırması
    kapalı (yoksa parmak hem kartı hem rafı çeker), bu yüzden ekranda görünen
    3-4 yuvanın ötesine parça taşınamıyordu. Parmak rafın kenarına gelince raf
    kendiliğinden kayıyor: kart parmağın altında kalırken yuvalar altından
    geçiyor, böylece rafın sonuna kadar gidilebiliyor.
  */
  const autoScroll = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAuto = () => {
    if (autoScroll.current) {
      clearInterval(autoScroll.current);
      autoScroll.current = null;
    }
  };
  const stepScroll = (dir: number) => {
    const c = cur.current;
    const row = Math.max(
      0,
      Math.min(
        Math.ceil(c.order.length / c.per) - 1,
        Math.floor((lastPan.current.y + cellH / 2) / rowH),
      ),
    );
    const inRow = Math.min(c.per, c.order.length - row * c.per);
    const contentW = RACK_PAD_L * 2 + inRow * RACK_STEP - RACK_GAP;
    const max = Math.max(0, contentW - width);
    const next = Math.max(0, Math.min(max, (scrollX.current[row] ?? 0) + dir * 18));
    if (next === (scrollX.current[row] ?? 0)) return;
    scrollX.current[row] = next;
    scrollRefs.current[row]?.scrollTo({ x: next, animated: false });
    applyTarget();
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => !!dragRef.current,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          if (!dragRef.current) return;
          const x = startPos.current.x + g.dx;
          const y = startPos.current.y + g.dy;
          pan.setValue({ x, y });
          lastPan.current = { x, y };
          applyTarget();

          // Parmak kenara yaklaştıysa rafı kendiliğinden kaydır
          const dir = g.moveX < EDGE ? -1 : g.moveX > width - EDGE ? 1 : 0;
          if (dir === 0) stopAuto();
          else if (!autoScroll.current) {
            autoDir.current = dir;
            autoScroll.current = setInterval(() => stepScroll(autoDir.current), 16);
          } else autoDir.current = dir;
        },
        onPanResponderRelease: () => finish(),
        onPanResponderTerminate: () => finish(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const finish = () => {
    const c = cur.current;
    const key = dragRef.current;
    dragRef.current = null;
    stopAuto();
    /*
      Sürüklenen karonun kendi Animated konumu, sürükleme boyunca hiç
      güncellenmiyor (aşağıdaki etki onu atlıyor) — yani ESKİ yerinde
      duruyor. Bırakınca yüzen kopya yok oluyor ve karo eski yerinde
      belirip oradan yuvasına koşuyordu ("saçma hareket").
      Çözüm: karoyu parmağın BIRAKTIĞI noktaya kurup oradan yuvasına
      yaylandırmak. Yüzen kopya ile karo aynı noktada devraldığı için
      hareket kesintisiz; yay da diğer karolarla aynı, ek animasyon yok.
    */
    if (key) {
      const idx = c.order.findIndex((it) => it.id === key);
      if (idx >= 0) {
        const col = idx % c.per;
        const row = Math.floor(idx / c.per);
        const v = posOf(key, col);
        // Rack ekseninden karonun bulunduğu SATIRIN yerel eksenine çevir
        v.setValue({
          x: lastPan.current.x - RACK_PAD_L + (scrollX.current[row] ?? 0),
          y: lastPan.current.y - (row * rowH + RACK_PAD_T),
        });
        Animated.spring(v, {
          toValue: { x: col * RACK_STEP, y: 0 },
          useNativeDriver: true,
          friction: 13,
          tension: 110,
        }).start();
      }
    }
    setDragId(null);
    c.onReorder(c.order.map((it) => it.id));
  };

  const beginHold = (item: WardrobeItem) => {
    hold.current = setTimeout(() => {
      const c = cur.current;
      const i = c.order.findIndex((x) => x.id === item.id);
      if (i < 0) return;
      const p = localPos(i);
      startPos.current = p;
      pan.setValue(p);
      dragRef.current = item.id;
      setDragId(item.id);
    }, 220);
  };
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current);
  };

  useEffect(() => {
    order.forEach((it, i) => {
      if (it.id === dragRef.current) return;
      Animated.spring(posOf(it.id, i % per), {
        toValue: { x: (i % per) * RACK_STEP, y: 0 },
        useNativeDriver: true,
        friction: 13,
        tension: 110,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, per]);

  const dragItem = order.find((it) => it.id === dragId);

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={styles.rackHead}>
        <Text style={styles.rackTitle}>{title}</Text>
        <Text style={styles.rackCount}>{items.length} PARÇA</Text>
      </View>

      <View {...responder.panHandlers}>
        {rows.map((row, r) => (
          <ScrollView
            key={r}
            ref={(v) => {
              scrollRefs.current[r] = v;
            }}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!dragId}
            onScroll={(e) => {
              scrollX.current[r] = e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
            contentContainerStyle={styles.rack}
          >
            {/*
              Askı kipinde boru kancaların ARKASINDAN, raf kipinde çizgi
              parçaların ALTINDAN geçiyor — parçalar rafın üstünde duruyor.
              İkisi de aynı renkte; raf yüzeyi tek düz çizgi, parçalar arasında
              ayraç yok.
            */}
            <LinearGradient
              colors={[luxe.outlineSoft, luxe.surfaceHigh, luxe.outlineSoft]}
              style={[styles.rail, shelf && { top: RACK_PAD_T + SHELF_IMG_H }]}
              pointerEvents="none"
            />
            <View style={{ width: row.length * RACK_STEP - RACK_GAP, height: cellH }}>
              {row.map((it, ci) => (
                <Animated.View
                  key={it.id}
                  style={{
                    position: 'absolute',
                    width: CARD_W,
                    transform: posOf(it.id, ci).getTranslateTransform(),
                    opacity: it.id === dragId ? 0 : 1,
                  }}
                  onTouchStart={() => beginHold(it)}
                  onTouchEnd={cancelHold}
                  onTouchCancel={cancelHold}
                >
                  <Hanger item={it} shelf={shelf} onPress={() => onOpen(it.id)} />
                </Animated.View>
              ))}
            </View>
          </ScrollView>
        ))}

        {/* Sürüklenen parça rafların ÜSTÜNDE yüzüyor — raf sınırına takılmasın */}
        {dragItem ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: CARD_W,
              transform: pan.getTranslateTransform(),
              zIndex: 30,
              elevation: 30,
            }}
          >
            <Hanger item={dragItem} shelf={shelf} dragging onPress={() => {}} />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/** Hap biçimli filtre; seçiliyken iridesan geçiş. */
function PillChip({
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
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Boş durum — emoji yerine ince çizgi ikon. */
function Empty({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={30} color={luxe.outlineSoft} />
      <Text style={[luxeType.headlineItalic, { marginTop: 12 }]}>{title}</Text>
      <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>{message}</Text>
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

/** Editoryal düğme — Bugün sayfasındakiyle aynı dil. */
function LuxeButton({
  title,
  onPress,
  icon,
  variant = 'solid',
  disabled,
  style,
}: {
  title?: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  variant?: 'solid' | 'outline' | 'danger';
  disabled?: boolean;
  style?: any;
}) {
  const solid = variant === 'solid';
  const fg = solid ? luxe.onPrimary : variant === 'danger' ? luxe.danger : luxe.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        !title && styles.btnIconOnly,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.82 },
        style,
      ]}
    >
      {/* Zemin elle kesilmiş siluet — düz köşe yarıçapı değil (bkz. FinBlob). */}
      <FinBlob
        /* Kare kutuda hap siluetı fıçıya dönüp kesik duruyor; yuvarlak oturuyor. */
        variant={title ? 'button' : 'pebble'}
        shadow={solid}
        pad={BTN_PAD}
        color={solid ? luxe.primary : glass.fill}
        stroke={solid ? undefined : variant === 'danger' ? luxe.danger : luxe.outlineSoft}
      />
      <View style={styles.btnRow}>
        {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
        {title ? <Text style={[styles.btnText, { color: fg }]}>{title}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function Wardrobe() {
  const {
    items, outfits, selfies, lookbooks,
    addSelfie, deleteSelfie, addLookbook, sharePost, reorderLookbooks, reorderItems,
  } = useStore();
  const { width } = useWindowDimensions();
  // Modallar alt sistem çubuğunun altında kalmasın
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [section, setSection] = useState<Section>('parcalar');
  /*
    Derin bağlantı: profildeki "öne çıkanlar" halkaları (Selfie, Lookbook…)
    doğrudan ilgili bölümü açsın. Sekme ekranı zaten monte olduğu için
    başlangıç değeri yetmiyor, parametre değişimi izleniyor. `t` her
    dokunuşta değiştiği için aynı bölüme arka arkaya gitmek de çalışıyor.
  */
  useEffect(() => {
    const want = params.section;
    if (want === 'parcalar' || want === 'kombinler' || want === 'selfiler' || want === 'lookbooklar') {
      setSection(want);
    }
  }, [params.section, params.t]);

  // Parçalar filtreleri
  const [category, setCategory] = useState<Category | 'hepsi'>('hepsi');
  /** Alt tür filtresi — çoklu seçim, boşsa o kategorinin hepsi gösterilir. */
  const [subcats, setSubcats] = useState<string[]>([]);
  /** Alt tür listesi açık mı — kapalıyken tek satır, ekran kalabalıklaşmıyor. */
  const [subOpen, setSubOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Selfie görüntüleme + paylaşım
  const [openSelfie, setOpenSelfie] = useState<Selfie | null>(null);
  const [askDeleteSelfie, setAskDeleteSelfie] = useState<Selfie | null>(null);
  const [shareSelfieOpen, setShareSelfieOpen] = useState<Selfie | null>(null);

  // Lookbook oluşturma
  const [lbModal, setLbModal] = useState(false);
  const [lbName, setLbName] = useState('');
  const [lbEmoji, setLbEmoji] = useState('📖');

  const cols = width > 700 ? 5 : 3;
  const thumb = (Math.min(width, 700) - 20 * 2 - 8 * (cols - 1)) / cols;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return items.filter((i) => {
      if (i.archived !== showArchived) return false;
      if (category !== 'hepsi' && i.category !== category) return false;
      if (subcats.length && (!i.subcategory || !subcats.includes(i.subcategory))) return false;
      if (onlyFav && !i.favorite) return false;
      if (q) {
        const hay = `${i.name} ${i.brand ?? ''} ${i.tags.join(' ')}`.toLocaleLowerCase('tr');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, category, subcats, query, onlyFav, showArchived]);

  /** Askılıklar kategoriye göre gruplanır — örnekteki "Üst Giyim / Alt Giyim" bölümleri. */
  const racks = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        items: filtered.filter((i) => i.category === c.id),
      })).filter((r) => r.items.length > 0),
    [filtered],
  );

  /** Selfie ekle — kırpma açık (dikey kadraj), kalıcı kopya saklanır. */
  const saveSelfiePhoto = async (photo: PickedPhoto) => {
    const small = await resizeForProcessing(photo.uri, photo.width, photo.height, 1400);
    const saved = await persistGarmentPhoto(small).catch(() => small);
    addSelfie({ imageUri: saved, date: todayISO() });
  };

  const takeSelfie = async (fromCamera: boolean) => {
    const photo = await pickPhoto({ fromCamera, aspect: [3, 4], quality: 0.6, purpose: 'selfie' });
    if (photo) await saveSelfiePhoto(photo);
  };

  // Android'de süreç öldüyse kök layout selfie'yi parametreyle buraya yollar
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    const photo = photoFromParams(params);
    if (!photo) return;
    recoveredRef.current = true;
    setSection('selfiler');
    saveSelfiePhoto(photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const confirmDeleteSelfie = (s: Selfie) => {
    setAskDeleteSelfie(s);
  };

  const doShareSelfie = (caption: string) => {
    const s = shareSelfieOpen;
    if (!s) return;
    sharePost({
      kind: 'selfie',
      caption,
      garments: [],
      imageUri: s.imageUri,
      archetypeId: useStore.getState().profile.bettaArchetypeId,
    });
    setShareSelfieOpen(null);
    setOpenSelfie(null);
    // Modal kapanışı işlensin, sonra git (ekran donmadan önce)
    setTimeout(() => router.push('/(tabs)/community'), 120);
  };

  const createLookbook = () => {
    if (!lbName.trim()) return;
    const lb = addLookbook({ name: lbName.trim(), emoji: lbEmoji, outfitIds: [] });
    setLbModal(false);
    setLbName('');
    // Modal kapanışı işlensin, sonra git (ekran donmadan önce)
    setTimeout(() => router.push({ pathname: '/lookbook/[id]', params: { id: lb.id } }), 80);
  };

  const counts = {
    parcalar: items.filter((i) => !i.archived).length,
    kombinler: outfits.length,
    selfiler: selfies.length,
    lookbooklar: lookbooks.length,
  };

  /*
    Bölümler HAP DEĞİL yatay sekme: sayfada zaten arama, favori, arşiv,
    kategori ve alt tür var; dört hap daha eklenince ekran düğme tarlasına
    dönüyordu. Sekme çizgisi aynı bilgiyi taşıyor, ağırlığı taşımıyor.
  */
  const SectionTab = ({ id, label }: { id: Section; label: string }) => {
    const on = section === id;
    return (
      <Pressable onPress={() => setSection(id)} style={styles.tab}>
        <Text style={[styles.tabText, on && styles.tabTextActive]}>
          {label} <Text style={styles.tabCount}>{counts[id]}</Text>
        </Text>
        {on ? (
          <LinearGradient
            colors={iridescent.full}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tabUnderline}
          />
        ) : null}
      </Pressable>
    );
  };

  const openItem = (id: string) => router.push({ pathname: '/item/[id]', params: { id } });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      {/* Bugün ile AYNI zemin — ekranlar arası geçişte ton atlamasın. */}
      <Backdrop />
      <ConfirmModal
        visible={!!askDeleteSelfie}
        title="Selfie'yi sil"
        message="Bu selfie arşivinden kalkacak. Bu işlem geri alınamaz."
        onConfirm={() => {
          if (askDeleteSelfie) deleteSelfie(askDeleteSelfie.id);
          setAskDeleteSelfie(null);
          setOpenSelfie(null);
        }}
        onCancel={() => setAskDeleteSelfie(null)}
      />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={luxeType.display}>Gardırop</Text>
        </View>
        {/*
          Başlıktaki eylem düğmeleri YALNIZCA İKON: ne eklendiğini zaten
          seçili bölüm söylüyor, yazı tekrar oluyordu. Kare kutu + yuvarlak
          siluet, selfie bölümündekiyle aynı dil.
        */}
        {section === 'parcalar' ? (
          <LuxeButton icon="add" onPress={() => router.push('/item/new')} />
        ) : section === 'kombinler' ? (
          <LuxeButton icon="add" onPress={() => router.push('/(tabs)/studio')} />
        ) : section === 'selfiler' ? (
          /*
            Aralık 0: siluet kutunun 7px içinden başlıyor (gölge payı), yani
            iki düğme arasında zaten iki pay kadar boşluk görünüyor.
          */
          <View style={{ flexDirection: 'row' }}>
            <LuxeButton icon="camera-outline" onPress={() => takeSelfie(true)} />
            <LuxeButton icon="images-outline" variant="outline" onPress={() => takeSelfie(false)} />
          </View>
        ) : (
          <LuxeButton icon="add" onPress={() => setLbModal(true)} />
        )}
      </View>

      {/* Bölüm sekmeleri — sabit yükseklik: liste büyüyünce ezilmesin */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionTabsBar}
        contentContainerStyle={{ gap: 20, paddingHorizontal: 20, alignItems: 'flex-end' }}
      >
        <SectionTab id="parcalar" label="Parçalar" />
        <SectionTab id="kombinler" label="Kombinler" />
        <SectionTab id="selfiler" label="Selfie'ler" />
        <SectionTab id="lookbooklar" label="Lookbook'lar" />
      </ScrollView>

      {/* ————— PARÇALAR ————— */}
      {section === 'parcalar' ? (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={luxe.outline} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ara: isim, marka, etiket…"
                placeholderTextColor={luxe.outline}
                style={styles.searchInput}
              />
            </View>
            <Pressable onPress={() => setOnlyFav((v) => !v)} style={styles.iconBtn}>
              <Ionicons
                name={onlyFav ? 'heart' : 'heart-outline'}
                size={19}
                color={onlyFav ? luxe.primary : luxe.outline}
              />
            </Pressable>
            <Pressable onPress={() => setShowArchived((v) => !v)} style={styles.iconBtn}>
              <Ionicons
                name={showArchived ? 'archive' : 'archive-outline'}
                size={18}
                color={showArchived ? luxe.primary : luxe.outline}
              />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipBar}
            contentContainerStyle={styles.chipRow}
          >
            <PillChip
              label="Hepsi"
              active={category === 'hepsi'}
              onPress={() => {
                setCategory('hepsi');
                setSubcats([]);
                setSubOpen(false);
              }}
            />
            {CATEGORIES.map((c) => (
              <PillChip
                key={c.id}
                label={c.label}
                active={category === c.id}
                onPress={() => {
                  setCategory(c.id);
                  // Kategori değişince eski alt tür seçimi anlamsız kalır
                  setSubcats([]);
                  setSubOpen(false);
                }}
              />
            ))}
          </ScrollView>

          {/*
            Alt tür filtresi — ÇOKLU SEÇİM, açılır onay kutulu liste.
            Önce yan yana kayan etiketlerdi: ekranda arama + kategori + alt tür
            üst üste üç şerit oluşturup sayfayı boğuyordu. Kapalıyken tek satır.
          */}
          {category !== 'hepsi' && subcategoriesOf(category).length > 0 ? (
            <View style={styles.subWrap}>
              <Pressable onPress={() => setSubOpen((v) => !v)} style={styles.subHead}>
                <Text style={styles.subHeadText}>
                  Alt tür{subcats.length ? ` · ${subcats.length}` : ''}
                </Text>
                <Ionicons
                  name={subOpen ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={luxe.outline}
                />
              </Pressable>
              {subOpen ? (
                <View style={styles.subList}>
                  {subcategoriesOf(category).map((sc) => {
                    const on = subcats.includes(sc.id);
                    return (
                      <Pressable
                        key={sc.id}
                        onPress={() =>
                          setSubcats((prev) =>
                            prev.includes(sc.id)
                              ? prev.filter((x) => x !== sc.id)
                              : [...prev, sc.id],
                          )
                        }
                        style={styles.subRow}
                      >
                        <Ionicons
                          name={on ? 'checkbox' : 'square-outline'}
                          size={17}
                          color={on ? luxe.primary : luxe.outline}
                        />
                        <Text style={[styles.subLabel, on && { color: luxe.ink }]}>{sc.label}</Text>
                      </Pressable>
                    );
                  })}
                  {subcats.length ? (
                    <Pressable onPress={() => setSubcats([])} style={styles.subClear}>
                      <Text style={styles.subClearText}>Seçimi temizle</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {filtered.length === 0 ? (
            <Empty
              icon={showArchived ? 'archive-outline' : 'shirt-outline'}
              title={showArchived ? 'Arşiv boş' : 'Burada henüz bir şey yok'}
              message={showArchived ? 'Arşivlediğin parçalar burada görünür.' : 'İlk parçanı ekle.'}
              action={
                !showArchived ? (
                  <LuxeButton icon="add" title="Parça ekle" onPress={() => router.push('/item/new')} />
                ) : undefined
              }
            />
          ) : (
            <ScrollView contentContainerStyle={{ paddingTop: 6, paddingBottom: 40 }}>
              {racks.map((r) => (
                <Rack
                  key={r.id}
                  title={r.label}
                  items={r.items}
                  onOpen={openItem}
                  onReorder={reorderItems}
                  // Bölme yalnızca tek kategori seçiliyken; "Hepsi"de tek raf
                  maxPerRow={category === 'hepsi' ? undefined : RACK_MAX}
                  /*
                    Ayakkabı ve aksesuar ASILMAZ: tek kategori seçilince raf
                    kipine geçiyorlar. "Hepsi" görünümü olduğu gibi kalıyor.
                  */
                  shelf={category !== 'hepsi' && (r.id === 'ayakkabi' || r.id === 'aksesuar')}
                />
              ))}
            </ScrollView>
          )}
        </>
      ) : null}

      {/* ————— KOMBİNLER ————— */}
      {section === 'kombinler' ? (
        outfits.length === 0 ? (
          <Empty
            icon="color-palette-outline"
            title="Henüz kombin yok"
            message={'Stüdyo\'daki "Giydir beni" ya da Canvas ile ilk kombinini oluştur.'}
            action={<LuxeButton title="Stüdyoya git" onPress={() => router.push('/(tabs)/studio')} />}
          />
        ) : (
          <FlatList
            key="outfits"
            data={outfits}
            keyExtractor={(o) => o.id}
            numColumns={2}
            contentContainerStyle={{ padding: 20, gap: 18 }}
            columnWrapperStyle={{ gap: 18 }}
            renderItem={({ item: o }) => {
              const its = o.itemIds
                .map((x) => items.find((i) => i.id === x))
                .filter(Boolean) as WardrobeItem[];
              return (
                <Pressable
                  style={{ flex: 1, maxWidth: '48%' }}
                  onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: o.id } })}
                >
                  <OutfitCollage items={its} size={(width - 20 * 3) / 2} layout={o.layout} frame={o.canvasFrame} cropToContent={o.cropToContent} />
                  <View style={styles.outfitMeta}>
                    {o.favorite ? <Ionicons name="heart" size={12} color={luxe.primary} /> : null}
                    <Text style={[luxeType.caption, { flexShrink: 1 }]} numberOfLines={1}>
                      {o.name}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )
      ) : null}

      {/* ————— SELFIE'LER ————— */}
      {section === 'selfiler' ? (
        selfies.length === 0 ? (
          <Empty
            icon="camera-outline"
            title="Henüz selfie yok"
            message="Günün kombiniyle ayna selfie'si çek, gardırobun canlı arşivin olsun."
            action={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <LuxeButton icon="camera-outline" title="Çek" onPress={() => takeSelfie(true)} />
                <LuxeButton
                  icon="images-outline"
                  variant="outline"
                  title="Galeriden"
                  onPress={() => takeSelfie(false)}
                />
              </View>
            }
          />
        ) : (
          <FlatList
            key={`selfies-${cols}`}
            data={selfies}
            numColumns={cols}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: 20, gap: 8 }}
            columnWrapperStyle={{ gap: 8 }}
            renderItem={({ item: s }) => (
              <Pressable onPress={() => setOpenSelfie(s)}>
                {/* Gerçek insan fotoğrafı — `cover` kalabilir */}
                <Photo
                  uri={s.imageUri}
                  icon="camera-outline"
                  style={{ width: thumb, height: thumb * 1.25, borderRadius: luxeRadius.md }}
                />
                <Text style={[luxeType.caption, { fontSize: 11, marginTop: 4 }]}>
                  {prettyDate(s.date)}
                </Text>
              </Pressable>
            )}
          />
        )
      ) : null}

      {/* ————— LOOKBOOK'LAR ————— */}
      {section === 'lookbooklar' ? (
        lookbooks.length === 0 ? (
          <Empty
            icon="book-outline"
            title="Henüz lookbook yok"
            message='Kombinlerini temalara ayır: "Ofis", "Yaz tatili", "Konser geceleri"…'
            action={
              <LuxeButton icon="add" title="İlk lookbook'unu oluştur" onPress={() => setLbModal(true)} />
            }
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/*
              Sıralama SÜRÜKLENEREK: karta basılı tutup taşıyınca yeri
              değişiyor. Satır yüksekliği SABİT olmak zorunda — mutlak
              konumlanan karolar için yuva hesabı buna dayanıyor.
            */}
            <Reorderable
              data={lookbooks}
              keyOf={(l) => l.id}
              columns={1}
              cellW={width - 40}
              cellH={LB_ROW_H}
              gap={12}
              onReorder={reorderLookbooks}
              renderItem={(lb, dragging) => {
                const cover =
                  outfits.find((o) => o.id === lb.coverOutfitId) ??
                  outfits.find((o) => lb.outfitIds.includes(o.id));
                const its = cover
                  ? (cover.itemIds
                      .map((x) => items.find((i) => i.id === x))
                      .filter(Boolean) as WardrobeItem[])
                  : [];
                return (
                  <Pressable
                    style={[styles.lbCard, { height: LB_ROW_H }, dragging && styles.lbCardDrag]}
                    onPress={() =>
                      router.push({ pathname: '/lookbook/[id]', params: { id: lb.id } })
                    }
                  >
                    {its.length ? (
                      <OutfitCollage
                        items={its}
                        size={72}
                        layout={cover?.layout}
                        frame={cover?.canvasFrame}
                        cropToContent={cover?.cropToContent}
                      />
                    ) : (
                      <View style={styles.lbEmpty}>
                        <LookbookIcon value={lb.emoji} size={26} color={luxe.outline} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.lbTitleRow}>
                        <LookbookIcon value={lb.emoji} size={17} />
                        <Text style={[luxeType.headline, { flexShrink: 1 }]} numberOfLines={1}>
                          {lb.name}
                        </Text>
                      </View>
                      <Text style={[luxeType.label, { marginTop: 4 }]}>
                        {lb.outfitIds.length} kombin
                      </Text>
                      {lb.description ? (
                        <Text style={[luxeType.caption, { marginTop: 2 }]} numberOfLines={1}>
                          {lb.description}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={dragging ? 'reorder-three' : 'chevron-forward'}
                      size={18}
                      color={luxe.outline}
                    />
                  </Pressable>
                );
              }}
            />
          </ScrollView>
        )
      ) : null}

      {/* Selfie görüntüleme modalı */}
      <Modal
        visible={!!openSelfie}
        animationType="fade"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpenSelfie(null)}
      >
        <View style={[styles.modalCenter, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.selfieModal}>
            {openSelfie ? (
              <>
                <Photo
                  uri={openSelfie.imageUri}
                  icon="camera-outline"
                  style={{ width: '100%', height: 380, borderRadius: luxeRadius.lg }}
                />
                {/* Kapat: fotoğrafın sağ üst köşesinde, ikon olarak */}
                <Pressable
                  onPress={() => setOpenSelfie(null)}
                  hitSlop={10}
                  style={({ pressed }) => [styles.selfieClose, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="close" size={19} color={luxe.primary} />
                </Pressable>
                <Text style={[luxeType.caption, { marginTop: 10 }]}>
                  {prettyDate(openSelfie.date)}
                </Text>
                {/*
                  İkisi de satırı PAYLAŞIYOR: dar kutuda siluet fıçıya dönüp
                  kenarları düzleşiyor, ayrıca "Kapat" alt satıra sarkıyordu.
                */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  <LuxeButton
                    icon="share-outline"
                    title="Toplulukta paylaş"
                    onPress={() => setShareSelfieOpen(openSelfie)}
                    /* Yazı tek satıra sığsın: bu düğme satırın çoğunu alıyor
                       ve yatay dolgusu biraz dar. */
                    style={{ flex: 2.6, paddingHorizontal: 10 + BTN_PAD }}
                  />
                  <LuxeButton
                    variant="danger"
                    icon="trash-outline"
                    title="Sil"
                    onPress={() => confirmDeleteSelfie(openSelfie)}
                    style={{ flex: 1, paddingHorizontal: 10 + BTN_PAD }}
                  />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Lookbook oluşturma modalı */}
      {/*
        `edgeToEdgeEnabled=true` iken sistem pencereyi klavye için yeniden
        boyutlandırmaz; `autoFocus` ile klavye hemen açıldığı için yazı alanı
        ve "Oluştur" düğmesi klavyenin altında kalıyordu.
      */}
      <Modal
        visible={lbModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setLbModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalWrap} behavior="padding">
          <View style={[styles.lbModal, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.modalHead}>
              <Text style={luxeType.headline}>Yeni lookbook</Text>
              <Pressable onPress={() => setLbModal(false)} hitSlop={8} style={styles.pill}>
                <Text style={styles.pillText}>Kapat</Text>
              </Pressable>
            </View>
            <TextInput
              value={lbName}
              onChangeText={setLbName}
              placeholder='Örn. "Yaz tatili", "Ofis haftası"'
              placeholderTextColor={luxe.outline}
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {LOOKBOOK_ICONS.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setLbEmoji(name)}
                  style={[styles.emojiBtn, lbEmoji === name && styles.emojiBtnActive]}
                >
                  <LookbookIcon
                    value={name}
                    size={19}
                    color={lbEmoji === name ? luxe.primary : luxe.outline}
                  />
                </Pressable>
              ))}
            </View>
            <LuxeButton
              title="Oluştur"
              onPress={createLookbook}
              disabled={!lbName.trim()}
              style={{ marginTop: 18, alignSelf: 'flex-start' }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ShareModal
        visible={!!shareSelfieOpen}
        defaultCaption={shareSelfieOpen?.note || 'Bugünün aynası'}
        preview={
          shareSelfieOpen ? (
            <Image
              source={{ uri: shareSelfieOpen.imageUri }}
              style={{ width: 150, height: 190, borderRadius: luxeRadius.lg }}
              contentFit="cover"
            />
          ) : undefined
        }
        onClose={() => setShareSelfieOpen(null)}
        onShare={doShareSelfie}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  sectionTabsBar: {
    flexGrow: 0,
    flexShrink: 0,
    height: 42,
    borderBottomWidth: 1,
    borderBottomColor: luxe.outlineSoft,
    marginBottom: 12,
  },
  tab: { paddingBottom: 9 },
  tabText: { fontFamily: font.bodyMedium, fontSize: 14, color: luxe.outline },
  tabTextActive: { color: luxe.ink },
  tabCount: { fontFamily: font.body, fontSize: 11, color: luxe.outline },
  /** Aktif sekmenin altındaki iridesan çizgi — kimliğin ince bir tekrarı. */
  tabUnderline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1 },

  // Askılık
  rackHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  rackTitle: { fontFamily: font.headline, fontSize: 17, color: luxe.primary },
  rackCount: { fontFamily: font.label, fontSize: 10, letterSpacing: 1.6, color: luxe.outline },
  /*
    Kancaların üstten taşabilmesi için raf dolgusu cömert; kartlar örnekteki
    gibi hafifçe üst üste biniyor (negatif boşluk).
  */
  rack: { paddingTop: 19, paddingBottom: 14, paddingHorizontal: 20, gap: 0 },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 23,
    height: 4,
    borderRadius: 3,
  },
  hook: {
    width: 19,
    height: HOOK_H,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: luxe.outline,
    borderTopLeftRadius: 9.5,
    borderTopRightRadius: 9.5,
    alignSelf: 'center',
    marginTop: -HOOK_H + 9,
  },
  card: {
    width: CARD_W,
    marginRight: -8,
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.md,
    overflow: 'hidden',
    ...luxeShadow.card,
  },
  cardImg: {
    width: '100%',
    height: CARD_IMG_H,
    backgroundColor: luxe.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    /* Koyu daire karta ağır bir leke bırakıyordu; cam rozet daha sessiz. */
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Raf kipinde parça: kart yok, çerçeve yok — doğrudan rafın üstünde. */
  shelfItem: { width: CARD_W },
  /*
    Görselin arkasında ZEMİN YOK. Beyaz kutu, fotoğrafı kesiyormuş gibi
    gösteriyordu ve raf boyunca kesintisiz bir şerit oluşturuyordu — oysa
    parçalar arasında ayraç olmamalı, arkada sayfanın kendi zemini kalmalı.
  */
  shelfImg: {
    width: '100%',
    height: SHELF_IMG_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Ad/renk çizginin ALTINDA, zeminsiz — raf etiketi gibi. */
  shelfMeta: { paddingHorizontal: 6, paddingTop: 8 },
  cardMeta: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.94)' },
  cardName: {
    fontFamily: font.label,
    fontSize: 8.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: luxe.ink,
  },
  cardColor: { fontFamily: font.body, fontSize: 9.5, color: luxe.outline, marginTop: 2 },

  // Filtreler
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: glass.fillStrong,
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 14, color: luxe.ink, padding: 0 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBar: { flexGrow: 0, flexShrink: 0 },

  // Alt tür: açılır onay kutulu liste
  subWrap: { paddingHorizontal: 20, marginBottom: 10 },
  subHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  subHeadText: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.outline,
  },
  subList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.md,
    padding: 10,
    gap: 4,
  },
  /** İki sütun: yüzde genişlik, uzun etiketlerde de hizalı kalıyor. */
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 7, width: '48%', paddingVertical: 5 },
  subLabel: { fontFamily: font.body, fontSize: 13, color: luxe.inkSoft, flexShrink: 1 },
  subClear: { width: '100%', paddingTop: 6 },
  subClearText: { fontFamily: font.bodyMedium, fontSize: 12, color: luxe.primary },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 10 },

  pill: {
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    backgroundColor: glass.fill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  pillFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  pillText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: luxe.outline },
  pillTextActive: { color: luxe.ink },

  // Düğme
  btn: {
    paddingHorizontal: 16 + BTN_PAD,
    paddingVertical: 10 + BTN_PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * Yalnızca ikonlu düğme: kutu KARE olmalı ki siluet bozulmasın. Yatay
   * dolgu yazılı düğmeninkiyle aynı kalınca kutu genişliyor, iki ikon düğmesi
   * birbirinden uzak duruyordu.
   */
  btnIconOnly: { width: 24 + 2 * (10 + BTN_PAD), paddingHorizontal: 0 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnText: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  photoWrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: luxe.surfaceMid },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  outfitMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },

  /** Sürüklenen kart: hafifçe kalkıyor. */
  lbCardDrag: { transform: [{ scale: 1.03 }], borderColor: luxe.primarySoft },
  lbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: glass.fillStrong,
    borderRadius: luxeRadius.lg,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    padding: 12,
  },
  lbEmpty: {
    width: 84,
    height: 84,
    borderRadius: luxeRadius.md,
    backgroundColor: luxe.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalWrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  modalCenter: {
    flex: 1,
    backgroundColor: luxe.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  selfieModal: { backgroundColor: luxe.bg, borderRadius: luxeRadius.xl, padding: 20 },
  /** Fotoğrafın sağ üst köşesindeki kapat — cam yuvarlak, ince çizgi ikon. */
  selfieClose: {
    position: 'absolute',
    right: 30,
    top: 30,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbModal: {
    backgroundColor: luxe.bg,
    borderTopLeftRadius: luxeRadius.xl,
    borderTopRightRadius: luxeRadius.xl,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 15,
    color: luxe.ink,
    backgroundColor: glass.fillStrong,
  },
  lbTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  emojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnActive: { borderColor: luxe.primary, backgroundColor: luxe.primaryContainer },
});
