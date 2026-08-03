import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  FeDropShadow,
  Filter,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { ItemThumb } from '@/components/ItemThumb';
import { OutfitCollage } from '@/components/OutfitCollage';
import { ProfileButton } from '@/components/ProfileButton';
import { useWeather } from '@/hooks/useWeather';
import { localSuggest, type SuggestedOutfit } from '@/services/stylist';
import { weatherEmoji, weatherLabel } from '@/services/weather';
import { useStore } from '@/store/useStore';
import { getArchetype } from '@/theme';
import { font, glass, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
import { todayISO } from '@/types';

const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Havaya göre kısa giyim tavsiyesi — örnekteki "Stylist Insight" metninin
 * karşılığı. Tamamen yerel: API yok, anahtar gerekmiyor.
 */
function styleAdvice(w?: { tempMax: number; tempMin: number; precipProb: number }): string {
  if (!w) return 'Şehrini seç, günün havasına göre ne giyeceğini birlikte planlayalım.';
  const rain = w.precipProb > 40;
  const t = w.tempMax;
  const base =
    t >= 28
      ? 'Gün sıcak geçecek. Keten ve pamuk gibi nefes alan kumaşlar, açık tonlar iyi gider.'
      : t >= 22
        ? 'Hava ılıman. İnce bir üst ve rahat bir alt parça gün boyu yeterli olur.'
        : t >= 15
          ? 'Serin bir gün. Katmanlı giyin — ince triko ya da omuza atılacak bir ceket işini görür.'
          : t >= 8
            ? 'Soğuk. Kalın bir dış katman ve kapalı ayakkabı şart.'
            : 'Dondurucu. Mont, atkı ve bere olmadan çıkma.';
  const extra = rain
    ? ` Yağış ihtimali %${w.precipProb} — su geçirmez bir dış katman ekle.`
    : w.tempMax - w.tempMin >= 10
      ? ' Gece gündüz farkı yüksek, üstüne atacak bir şey al.'
      : '';
  return base + extra;
}

/** Editoryal düğme — hap biçimli; dolu (mauve) ya da ince çerçeveli. */
function LuxeButton({
  title,
  onPress,
  variant = 'solid',
  onDark,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
  /** Koyu zemin (hero) üstünde kullanılacaksa açık renklere geçer */
  onDark?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.btn,
        solid
          ? { backgroundColor: onDark ? luxe.onDark : luxe.primary }
          : {
              backgroundColor: onDark ? 'transparent' : glass.fill,
              borderWidth: 1,
              borderColor: onDark ? 'rgba(255,255,255,0.5)' : luxe.outlineSoft,
            },
        pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={solid ? luxe.onPrimary : luxe.primary} />
      ) : (
        <Text
          style={[
            styles.btnText,
            {
              color: solid
                ? onDark
                  ? luxe.primary
                  : luxe.onPrimary
                : onDark
                  ? luxe.onDark
                  : luxe.primary,
            },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Sayfa zemini: inci beyazı + köşelerden sızan radyal "ışık sızıntıları"
 * (sol üstte pudra pembe, sağ altta krem, arada menekşe) — örnekteki
 * `betta-flow-bg`. Radyal geçiş için SVG şart: `expo-linear-gradient`
 * yalnızca DOĞRUSAL gradyan çiziyor, RN'de radial-gradient karşılığı yok.
 */
function Backdrop() {
  return (
    <View style={styles.backdrop} pointerEvents="none">
      <Svg style={styles.backdropFill}>
        <Defs>
          {/*
            Örnekteki `betta-flow-bg` ile AYNI: sol üstte #FBDBDE, sağ altta
            #F0E1C7, ikisi de %40 ve %50'de sönümleniyor. Daha yoğun tonlar ve
            araya eklenen menekşe zemini örnekten uzaklaştırıyordu.
          */}
          <RadialGradient id="leakTop" cx="0%" cy="0%" r="50%">
            <Stop offset="0" stopColor="#FBDBDE" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#FBDBDE" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="leakBottom" cx="100%" cy="100%" r="50%">
            <Stop offset="0" stopColor="#F0E1C7" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#F0E1C7" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#leakTop)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#leakBottom)" />
      </Svg>
    </View>
  );
}

/**
 * Örnekteki `fin-curve`'ün BİREBİR karşılığı.
 *
 *   border-radius: 60% 40% 70% 30% / 30% 60% 40% 70%;
 *
 * Bu ELİPTİK köşe: her köşenin iki yarıçapı var (yatay = genişliğin yüzdesi,
 * dikey = yüksekliğin yüzdesi). RN'in `borderRadius`'ında karşılığı yok —
 * dört köşeye farklı piksel vermek yaklaşık bile değil, biçim "dijital"
 * duruyor. SVG'de tam karşılığı var: eliptik yay (`A rx ry ...`).
 *
 * Köşe yarıçapları (viewBox 100×100, yani doğrudan yüzde):
 *   sol üst  rx 60 ry 30   ·  sağ üst  rx 40 ry 60
 *   sağ alt  rx 70 ry 40   ·  sol alt  rx 30 ry 70
 * Her kenarda yarıçaplar toplamı tam %100 olduğu için düz kenar HİÇ kalmıyor;
 * biçmin organik görünmesinin sebebi bu.
 *
 * `preserveAspectRatio="none"`: yüzdeler CSS'te olduğu gibi kutunun
 * ölçüsüne esner.
 *
 * Gölge de SVG filtresiyle (`FeDropShadow`): RN'in gölgesi görünümün
 * DİKDÖRTGEN dış hattını kullanıyor, blobun arkasında gri bir kutu çıkıyor
 * (cihazda görüldü). Filtre gerçek biçmi takip ediyor.
 * Yol kutuya TAM oturuyor; gölge payı görünümü dışarı taşırarak açılıyor
 * (ölçü `onLayout` ile alınıp viewBox payı hesaplanıyor). Yolu küçültmek
 * denendi ama o zaman biçim CSS'ten sapıyor.
 */
function FinBlob({ color, shadow }: { color: string; shadow?: boolean }) {
  /*
    Gölge payı. SVG'yi kartın DIŞINA taşırmak işe yaramıyor: Android
    çocuğu ebeveyn sınırında kırpıyor, gölge soldan ve alttan kesiliyordu
    (cihazda görüldü). Bu yüzden pay kartın İÇİNDE: dokunma kutusu bu kadar
    büyüyor, blob ise iç dikdörtgene çiziliyor.
  */
  const M = 18;
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  /*
    viewBox payı ÖLÇÜLEREK hesaplanıyor, göz kararı değil: yüzde cinsinden
    pay = 100 * M / kartBoyutu. Böylece yolun 0–100 aralığı kartın tam
    sınırlarına oturuyor, kalan yer de gölgenin oluyor.
  */
  const cw = box ? box.w - 2 * M : 0;
  const ch = box ? box.h - 2 * M : 0;
  const mx = cw > 0 ? (100 * M) / cw : 0;
  const my = ch > 0 ? (100 * M) / ch : 0;

  return (
    <View
      style={styles.blob}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
      }}
    >
      {box && cw > 0 && ch > 0 ? (
        <Svg
          width={box.w}
          height={box.h}
          viewBox={`${-mx} ${-my} ${100 + 2 * mx} ${100 + 2 * my}`}
          preserveAspectRatio="none"
        >
          {shadow ? (
            <Defs>
              <Filter id="finShadow" x="-40%" y="-40%" width="180%" height="180%">
                <FeDropShadow
                  dx="0"
                  dy={my * 0.3}
                  stdDeviation={my * 0.42}
                  floodColor="#70585B"
                  floodOpacity="0.3"
                />
              </Filter>
            </Defs>
          ) : null}
          <Path
            d="M60 0 A40 60 0 0 1 100 60 A70 40 0 0 1 30 100 A30 70 0 0 1 0 30 A60 30 0 0 1 60 0 Z"
            fill={color}
            filter={shadow ? 'url(#finShadow)' : undefined}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Cam kart (glassmorphism). RN'de `backdrop-filter` yok ve `expo-blur` kurulu
 * değil; yarı saydam beyaz dolgu + açık kenarlıkla taklit ediliyor. Zemindeki
 * radyal parıltı altından geçtiği için etki yakın duruyor.
 *
 * ⚠️ Gölge (elevation) VERİLMİYOR: dolgu yarı saydam olduğu için Android'de
 * elevation gölgesi kartın içine beyaz bir dikdörtgen olarak sızıyor
 * (cihazda görüldü). Derinliği kenarlık ve ton farkı taşıyor — DESIGN.md
 * zaten gölge yerine "tonal katmanlama" istiyor.
 */
function GlassCard({
  children,
  tint,
  style,
}: {
  children: React.ReactNode;
  /** Vurgulu kart — pudra pembeye çalar. */
  tint?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.glassCard, tint && styles.glassCardTint, style]}>{children}</View>;
}

export default function Today() {
  const { profile, items, outfits, plans, setPlan, clearPlan, wearOutfit, logWear, addOutfit } =
    useStore();
  const { week, todayWeather, loading, error, useDeviceLocation, useCity } = useWeather();
  const { width } = useWindowDimensions();

  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const [suggestion, setSuggestion] = useState<SuggestedOutfit | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [askCity, setAskCity] = useState(false);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);
  // Hava durumu API'si bugünden başlayan 7 günü sırayla döndürür; cihaz saat
  // dilimiyle konum saat dilimi farklı olabileceği için tarih-string yerine
  // sıraya (index) göre hizalıyoruz — her gün hücresi kendi gününün havasını alır.
  const weatherFor = (date: string) => {
    const idx = weekDates.indexOf(date);
    return idx >= 0 ? week[idx] : undefined;
  };
  const selectedWeather = weatherFor(selectedDate);
  const selectedPlan = plans.find((p) => p.date === selectedDate);
  const planOutfit = selectedPlan?.outfitId
    ? outfits.find((o) => o.id === selectedPlan.outfitId)
    : undefined;
  const planItems = (planOutfit?.itemIds ?? selectedPlan?.itemIds ?? [])
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as NonNullable<ReturnType<typeof items.find>>[];

  const activeItems = items.filter((i) => !i.archived);
  const suggestedItems = (suggestion?.itemIds ?? [])
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as typeof items;

  const shuffle = () => {
    setSuggestion(localSuggest(activeItems, selectedWeather ?? todayWeather));
  };

  const saveSuggestionAsOutfit = () => {
    if (!suggestion) return;
    const o = addOutfit({
      name: `Öneri · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`,
      itemIds: suggestion.itemIds,
      favorite: false,
    });
    setPlan({ date: selectedDate, outfitId: o.id });
    setSuggestion(null);
  };

  const hasLocation = profile.lat != null;
  const archetype = getArchetype(profile.bettaArchetypeId);
  // Kenar boşluğu düşülmüş kart genişliği — hero kolajı kareyi tam doldursun.
  const heroSize = width - 2 * 20;
  const isToday = selectedDate === today;
  const selectedLabel = isToday
    ? 'Bugünün kombini'
    : new Date(`${selectedDate}T12:00:00`).toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
  /** Örnekteki "Look Completion" karşılığı — uydurma değil, gerçek plan sayısı. */
  const plannedDays = weekDates.filter((d) =>
    plans.some((p) => p.date === d && (p.outfitId || p.itemIds?.length)),
  ).length;

  /** Şehir arama alanı — hem ilk kurulumda hem "değiştir"de aynı görünüm. */
  const cityForm = (placeholder: string) => (
    <View style={styles.cityRow}>
      <TextInput
        value={cityInput}
        onChangeText={setCityInput}
        placeholder={placeholder}
        placeholderTextColor={luxe.outline}
        style={styles.cityInput}
        onSubmitEditing={async () => {
          if (await useCity(cityInput)) setAskCity(false);
        }}
      />
      <LuxeButton
        title="Bul"
        onPress={async () => {
          if (await useCity(cityInput)) setAskCity(false);
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      <Backdrop />

      {/* Üst çubuk: avatar · marka · ayarlar */}
      <View style={styles.header}>
        <ProfileButton size={36} />
        <Text style={styles.wordmark}>Betta</Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={8}
          style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
        >
          <Ionicons name="settings-outline" size={21} color={luxe.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Başlık + hava rozeti */}
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            {/* Ölçüler bilerek temadan küçük: üst blok kısalınca kombin
                sayfaya girer girmez görünüyor. */}
            <Text style={[luxeType.display, styles.hello]}>Hoş geldin,</Text>
            <Text style={[luxeType.displayItalic, styles.helloName]}>
              {profile.name || 'Betta'}
            </Text>
          </View>

          {/* Hava rozeti — organik köşeli cam blok; dokununca şehir değişir */}
          <Pressable
            onPress={() => setAskCity((v) => !v)}
            style={({ pressed }) => [styles.weatherBlob, pressed && { opacity: 0.85 }]}
          >
            <FinBlob shadow color={glass.fillStrong} />
            {hasLocation && todayWeather ? (
              <>
                <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
                  <Text style={styles.weatherTemp}>{todayWeather.tempMax}°</Text>
                  <Text style={styles.weatherCity} numberOfLines={1}>
                    {profile.city}
                  </Text>
                </View>
                <Text style={{ fontSize: 24 }}>{weatherEmoji(todayWeather.weatherCode)}</Text>
              </>
            ) : (
              <>
                <Text style={styles.weatherCity}>Şehir{'\n'}seç</Text>
                <Text style={{ fontSize: 22 }}>🌤️</Text>
              </>
            )}
          </Pressable>
        </View>

        {archetype ? (
          <Text style={[luxeType.caption, { marginTop: 8, fontSize: 12 }]}>
            {archetype.emoji} {archetype.styleName} · {archetype.fish}
          </Text>
        ) : null}

        {/* Haftalık plan */}
        <Text style={[luxeType.headline, styles.sectionTitle]}>Haftalık plan</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 0, paddingRight: 20 }}
        >
          {weekDates.map((date, i) => {
            const d = new Date(`${date}T12:00:00`);
            const w = week[i];
            const planned = plans.some((p) => p.date === date && (p.outfitId || p.itemIds?.length));
            const active = date === selectedDate;
            return (
              <Pressable
                key={date}
                onPress={() => {
                  setSelectedDate(date);
                  setSuggestion(null);
                }}
                style={[styles.day, active && styles.dayActive]}
              >
                {active ? (
                  <FinBlob shadow color="#F4E6E6" />
                ) : (
                  /* Zemin kutuya değil İÇ dikdörtgene: kutu gölge payı kadar
                     büyük, zemini kutuya verince kart şişik görünüyor. */
                  <View style={styles.dayPlain} pointerEvents="none" />
                )}
                <Text style={[styles.dayName, active && { color: luxe.primary }]}>
                  {DAY_NAMES[d.getDay()]}
                </Text>
                <Text style={[styles.dayNum, active && { color: luxe.primary }]}>
                  {d.getDate()}
                </Text>
                {w ? (
                  <>
                    <Text style={{ fontSize: 11 }}>{weatherEmoji(w.weatherCode)}</Text>
                    <Text style={[styles.dayTemp, active && { color: luxe.primary }]}>
                      {w.tempMax}°<Text style={styles.dayTempMin}> {w.tempMin}°</Text>
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 11 }}> </Text>
                    <Text style={styles.dayTemp}> </Text>
                  </>
                )}
                <View
                  style={[
                    styles.planDot,
                    { backgroundColor: planned ? luxe.primary : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        {/* HERO — seçili günün kombini */}
        {planItems.length ? (
          /*
            Gölge veren View ile kırpan View AYRI olmalı: Android'de
            elevation + borderRadius + overflow aynı görünümde birleşince
            mutlak konumlu çocuklar (perde, başlık, düğmeler) ÇİZİLMİYOR —
            ölçüm ağacında varlar ama ekranda yoklar.
          */
          <View style={[styles.hero, { height: heroSize }]}>
            <View style={styles.heroClip}>
              {/*
                Kolaja dokununca kombin sayfası. Gevşek parça planında (kombin
                kaydedilmemiş, sadece parça listesi) gidilecek sayfa yok — o
                durumda dokunma kapalı.
              */}
              <Pressable
                style={styles.heroArt}
                disabled={!planOutfit}
                onPress={() =>
                  planOutfit &&
                  router.push({ pathname: '/outfit/[id]', params: { id: planOutfit.id } })
                }
              >
                {planOutfit ? (
                  <OutfitCollage
                    items={planItems}
                    size={heroSize}
                    layout={planOutfit.layout}
                    frame={planOutfit.canvasFrame}
                    cropToContent={planOutfit.cropToContent}
                  />
                ) : (
                  <OutfitCollage items={planItems} size={heroSize} />
                )}
              </Pressable>

              {/*
                Perde BORDO: nötr koyu ton (siyah/mürdüm) beyaz kolajın üstünde
                griye düşüp görüntüyü çamurlaştırıyor. Bordo hem paletteki
                pembe/mauve ile akraba hem de parçaları griye çevirmiyor.
              */}
              <LinearGradient
                colors={['transparent', 'rgba(94,20,40,0.24)', 'rgba(94,20,40,0.62)']}
                locations={[0.36, 0.62, 1]}
                style={styles.heroShade}
                pointerEvents="none"
              />

              {/*
                Etiket sol üstte; satır sarmalı ŞART, çünkü
                `alignSelf: 'flex-start'` ile rozet metinden dar ölçülüp yazıyı
                soldan kırpıyordu ("...OMBİNİ").
              */}
              <View style={styles.heroTag} pointerEvents="none">
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText} numberOfLines={1}>
                    {selectedLabel}
                  </Text>
                </View>
              </View>

              {/*
                `box-none`: bant, düğmeleri dışındaki yerlerde dokunuşu ALTTAKİ
                kolaja geçirsin — yoksa kartın alt yarısı tıklanamaz oluyor.
              */}
              <View style={styles.heroBody} pointerEvents="box-none">
                <Text style={[luxeType.heroTitle, styles.heroShadowText]} numberOfLines={2}>
                  {planOutfit?.name ?? `${planItems.length} parça`}
                </Text>
                <Text style={[styles.heroSub, styles.heroShadowText]} numberOfLines={1}>
                  {planItems
                    .map((it) => it!.name)
                    .filter(Boolean)
                    .join(' · ')}
                  {selectedWeather
                    ? `  ${weatherEmoji(selectedWeather.weatherCode)} ${selectedWeather.tempMax}°`
                    : ''}
                </Text>
                <View style={styles.heroActions}>
                  {isToday && planOutfit ? (
                    <LuxeButton
                      onDark
                      title="Bugün bunu giydim"
                      onPress={() => {
                        wearOutfit(planOutfit.id, today);
                        clearPlan(today);
                      }}
                    />
                  ) : null}
                  {isToday && !planOutfit && selectedPlan?.itemIds?.length ? (
                    <LuxeButton
                      onDark
                      title="Bugün bunu giydim"
                      onPress={() => {
                        logWear(selectedPlan.itemIds!, today);
                        clearPlan(today);
                      }}
                    />
                  ) : null}
                  <LuxeButton
                    onDark
                    variant="outline"
                    title="Planı kaldır"
                    onPress={() => clearPlan(selectedDate)}
                  />
                </View>
              </View>
            </View>
          </View>
        ) : (
          <GlassCard tint style={styles.heroEmpty}>
            <Text style={[luxeType.label, { color: luxe.primary }]}>{selectedLabel}</Text>
            {/* "Bugün" HER ZAMAN bitişik; başka günler için ayrı metin. */}
            <Text style={[luxeType.headlineItalic, { marginTop: 8 }]}>
              {isToday ? 'Bugün için plan yok' : 'Henüz plan yok'}
            </Text>
            <Text style={[luxeType.body, { marginTop: 8 }]}>
              Kombinlerinden birini seç ya da gardırobundan sana bir öneri çıkaralım.
            </Text>
            <View style={styles.rowWrap}>
              <LuxeButton title="Kombinlerimden seç" onPress={() => setPickerOpen(true)} />
              <LuxeButton variant="outline" title="🎲 Bana öner" onPress={shuffle} />
            </View>
          </GlassCard>
        )}

        {/* Stilistin önerisi */}
        {suggestion && suggestedItems.length ? (
          <GlassCard tint style={{ marginTop: 16 }}>
            <Text style={[luxeType.label, { color: luxe.primary }]}>Stilistin önerisi</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, marginTop: 14 }}
            >
              {suggestedItems.map((it) => (
                <ItemThumb key={it.id} item={it} size={84} showName />
              ))}
            </ScrollView>
            <Text style={[luxeType.body, { marginTop: 14 }]}>{suggestion.reason}</Text>
            <View style={styles.rowWrap}>
              <LuxeButton title="Bugüne planla" onPress={saveSuggestionAsOutfit} />
              <LuxeButton variant="outline" title="🎲 Başka öner" onPress={shuffle} />
              <LuxeButton variant="outline" title="Vazgeç" onPress={() => setSuggestion(null)} />
            </View>
          </GlassCard>
        ) : null}

        {/* Stilistin yorumu */}
        <GlassCard style={{ marginTop: 22 }}>
          <View style={styles.insightGlow} pointerEvents="none" />
          <Text style={{ fontSize: 22 }}>✨</Text>
          <Text style={[luxeType.headlineItalic, { marginTop: 12 }]}>Stilistin yorumu</Text>
          <Text style={[luxeType.body, { marginTop: 10 }]}>{styleAdvice(todayWeather)}</Text>

          {/* Etiketler: arketipin stil anahtar kelimeleri — uydurma değil */}
          {archetype ? (
            <View style={styles.chipRow}>
              {archetype.keywords.slice(0, 3).map((k) => (
                <View key={k} style={styles.chip}>
                  <Text style={styles.chipText}>#{k}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Konum yoksa: şehir arama + konum izni */}
          {!hasLocation || (askCity && !todayWeather) ? (
            <View style={{ marginTop: 16 }}>
              {cityForm('Şehir adı (örn. İstanbul)')}
              <Pressable
                onPress={async () => {
                  if (await useDeviceLocation()) setAskCity(false);
                }}
                disabled={loading}
                style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.6 }]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={luxe.primary} />
                ) : (
                  <Text style={styles.linkBtnText}>📍 Konumumu kullan</Text>
                )}
              </Pressable>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          ) : null}

          {/* Konum varken hava rozetine dokununca */}
          {askCity && hasLocation && todayWeather ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[luxeType.caption, { marginBottom: 10 }]}>
                {weatherLabel(todayWeather.weatherCode)} · {todayWeather.tempMax}° /{' '}
                {todayWeather.tempMin}°
              </Text>
              {cityForm('Yeni şehir')}
            </View>
          ) : null}
        </GlassCard>

        {/* Haftanın doluluğu */}
        <GlassCard style={{ marginTop: 16 }}>
          <View style={styles.progressHead}>
            <Text style={luxeType.label}>Haftanın doluluğu</Text>
            <Text style={styles.progressValue}>{Math.round((plannedDays / 7) * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[luxe.primary, luxe.primarySoft]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${(plannedDays / 7) * 100}%` }]}
            />
          </View>
          <Text style={[luxeType.caption, styles.progressNote]}>
            7 günün {plannedDays} tanesi planlı
          </Text>
        </GlassCard>



        {/* AI stilist */}
        <GlassCard tint style={{ marginTop: 16 }}>
          <View style={styles.insightGlow} pointerEvents="none" />
          <Text style={{ fontSize: 22 }}>✨</Text>
          <Text style={[luxeType.headlineItalic, { marginTop: 12 }]}>AI Stilist'e danış</Text>
          <Text style={[luxeType.body, { marginTop: 10 }]}>
            Gardırobundaki parçalardan bugünkü enerjine uyanları seçmesi için sor: "Yarın
            toplantım var, ne giysem?"
          </Text>
          <LuxeButton
            title="Sohbete başla"
            onPress={() => router.push('/stylist')}
            style={{ marginTop: 18, alignSelf: 'flex-start' }}
          />
        </GlassCard>

        {/* Gardırop boşsa */}
        {activeItems.length === 0 ? (
          <GlassCard style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 32 }}>🐟</Text>
            <Text style={[luxeType.headlineItalic, { marginTop: 10 }]}>Gardırobun bomboş</Text>
            <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>
              Önce Gardırop sekmesinden birkaç parça ekle, akvaryumu dolduralım.
            </Text>
            <LuxeButton
              title="Parça ekle"
              onPress={() => router.push('/item/new')}
              style={{ marginTop: 16 }}
            />
          </GlassCard>
        ) : null}
      </ScrollView>

      {/* Kombin seçici */}
      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={luxeType.headline}>Kombin seç</Text>
              <Pressable
                onPress={() => setPickerOpen(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.chipText}>Kapat</Text>
              </Pressable>
            </View>
            <ScrollView>
              {outfits.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Text style={{ fontSize: 32 }}>🎨</Text>
                  <Text style={[luxeType.headlineItalic, { marginTop: 10 }]}>
                    Henüz kombin yok
                  </Text>
                  <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>
                    Stüdyo'dan ilk kombinini oluştur.
                  </Text>
                  <LuxeButton
                    title="Stüdyoya git"
                    style={{ marginTop: 16 }}
                    onPress={() => {
                      setPickerOpen(false);
                      router.push('/(tabs)/studio');
                    }}
                  />
                </View>
              ) : (
                <View style={styles.outfitGrid}>
                  {outfits.map((o) => {
                    const its = o.itemIds
                      .map((id) => items.find((i) => i.id === id))
                      .filter(Boolean) as typeof items;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => {
                          setPlan({ date: selectedDate, outfitId: o.id });
                          setPickerOpen(false);
                        }}
                        style={{ alignItems: 'center', width: 130 }}
                      >
                        <OutfitCollage
                          items={its}
                          size={130}
                          layout={o.layout}
                          frame={o.canvasFrame}
                          cropToContent={o.cropToContent}
                        />
                        <Text style={[luxeType.caption, { marginTop: 6 }]} numberOfLines={1}>
                          {o.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* RN 0.86'da StyleSheet.absoluteFillObject yok — düz obje. */
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  backdropFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  /** Marka: italik serif — örnekteki ince, zarif duruş */
  wordmark: {
    fontFamily: font.displayItalic,
    fontStyle: 'italic',
    fontSize: 23,
    color: luxe.primary,
  },
  container: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 56 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  hello: { fontSize: 26, lineHeight: 33 },
  helloName: { fontSize: 26, lineHeight: 34 },
  /** Organik köşeli cam hava rozeti (örnekteki `fin-curve`) */
  /**
   * Biçimi `FinBlob` çiziyor — zemin ve kenarlık burada yok.
   * İç boşluk gölge payını (FinBlob'daki M = 18) İÇERİR: blob kutunun
   * içine çizildiği için pay eklenmezse yazı biçimin dışına taşıyor.
   */
  weatherBlob: {
    /* Gölge payı kutuyu her yönden 18 büyütüyor; negatif kenar boşluğu
       rozeti eski yerine geri çekiyor. */
    marginTop: -18,
    marginRight: -18,
    marginBottom: -18,
    paddingHorizontal: 16 + 18,
    paddingVertical: 12 + 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 168 + 36,
  },
  weatherTemp: { fontFamily: font.display, fontSize: 23, lineHeight: 29, color: luxe.primary },
  weatherCity: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: luxe.inkSoft,
    textAlign: 'right',
  },

  // Hero
  /*
    Üst boşluk PLANLI ve PLANSIZ durumda AYNI olmalı — farklıydı ve kart
    kombin seçilince yukarı zıplayıp gün şeridini kesiyordu.
    Şeridin gölge payı (18px) altta zaten boşluk bıraktığı için değer negatif.
  */
  hero: {
    marginTop: -4,
    borderRadius: luxeRadius.xl,
    backgroundColor: luxe.surface,
    ...luxeShadow.hero,
  },
  /** Plansız durum: hero ile AYNI üst boşluk. */
  heroEmpty: { marginTop: -4 },
  heroClip: { flex: 1, borderRadius: luxeRadius.xl, overflow: 'hidden' },
  heroArt: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  heroShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroTag: { position: 'absolute', top: 18, left: 18, flexDirection: 'row' },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  heroPillText: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: luxe.primaryDeep,
  },
  heroBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 22 },
  heroSub: { fontFamily: font.body, fontSize: 13, color: luxe.onDarkSoft, marginTop: 6 },
  /*
    Perde bilerek HAFİF (kombin görünsün, ayakkabı yutulmasın diye), o yüzden
    beyaz yazı yer yer açık zemine denk geliyor. Perdeyi koyulaştırmak yerine
    yazıya gölge: okunurluk geliyor, kolaj kararmıyor.
  */
  heroShadowText: {
    textShadowColor: 'rgba(94,20,40,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },

  // Cam kartlar
  glassCard: {
    borderRadius: luxeRadius.lg,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    padding: 22,
    overflow: 'hidden',
  },
  glassCardTint: { backgroundColor: 'rgba(250,218,221,0.4)' },
  /** Kartın köşesinden sızan pembe hale */
  insightGlow: {
    position: 'absolute',
    right: -50,
    top: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: luxe.primaryContainer,
    opacity: 0.5,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  chip: {
    borderRadius: luxeRadius.pill,
    backgroundColor: 'rgba(240,225,199,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontFamily: font.bodyMedium, fontSize: 12, color: luxe.onSecondaryContainer },

  // İlerleme
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressValue: { fontFamily: font.display, fontSize: 20, color: luxe.primary },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.75)',
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressNote: { marginTop: 12, fontStyle: 'italic' },

  /*
    Negatif alt boşluk: gün kartları gölge payı (18px) kadar içeriden
    başlıyor, normal boşluk bunun üstüne binince arada kocaman bir aralık
    kalıyordu.
  */
  sectionTitle: { marginTop: 16, marginBottom: -10, fontSize: 19, lineHeight: 26 },

  // Hafta şeridi
  /*
    Örnekteki gün kartı: geniş (min 130px), bol iç boşluklu, 2.5rem yuvarlak
    cam kutu. Dar ve uzun hâli hap gibi görünüp örnekten uzaklaşıyordu.
  */
  day: {
    /*
      Ölçüler gölge payını (FinBlob'daki M = 18) İÇERİR: görünen kart
      88 geniş, kutu her yönden 18 fazla. Yatay negatif kenar boşluğu bu
      fazlalığı yutuyor ki kartlar arası görünen aralık 6px kalsın.
    */
    width: 88 + 36,
    marginHorizontal: -15,
    alignItems: 'center',
    /*
      Dikey boşluk bilerek cömert: blob kartın köşelerini yiyor, içerik
      kutunun en üstüne/altına dayanınca (özellikle nokta) biçimin dışında
      kalıyor. İçerik kabaca kartın %18–%82 aralığında duruyor.
    */
    /* Kareden BİRAZ uzun: tam karede blob fazla toparlak duruyor. */
    paddingTop: 14 + 18,
    paddingBottom: 14 + 18,
    /*
      Seçili OLMAYAN gün: soluk, çerçevesiz, yumuşak köşeli kart — örnekteki
      TUE/WED kartları. Yamukluk yalnızca seçili günde.
    */
    gap: 1,
  },
  /** Seçili olmayan günün zemini — gölge payı kadar içeride. */
  dayPlain: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 18,
    bottom: 18,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: luxeRadius.lg,
  },
  /** Seçili gün: zemin ve köşe yok — biçimi `FinBlob` çiziyor. */
  dayActive: { backgroundColor: 'transparent', borderRadius: 0 },
  blob: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  dayName: {
    fontFamily: font.label,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.outline,
  },
  dayNum: { fontFamily: font.display, fontSize: 17, lineHeight: 21, color: luxe.ink },
  dayTemp: { fontFamily: font.bodyMedium, fontSize: 10, color: luxe.inkSoft },
  dayTempMin: { color: luxe.outline },
  planDot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },

  // Düğme
  btn: {
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 22,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: font.label,
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },

  // Şehir formu
  cityRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 14.5,
    color: luxe.ink,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  linkBtn: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4 },
  linkBtnText: { fontFamily: font.bodyMedium, fontSize: 14, color: luxe.primary },
  errorText: { fontFamily: font.body, fontSize: 12.5, color: luxe.danger, marginTop: 8 },

  // Kombin seçici
  modalWrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: luxe.bg,
    borderTopLeftRadius: luxeRadius.xl,
    borderTopRightRadius: luxeRadius.xl,
    padding: 22,
    maxHeight: '75%',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  outfitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingBottom: 24 },
});
