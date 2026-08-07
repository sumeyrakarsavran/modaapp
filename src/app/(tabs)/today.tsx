import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { FinBlob } from '@/components/FinBlob';
import { ItemThumb } from '@/components/ItemThumb';
import { OutfitCollage } from '@/components/OutfitCollage';
import { ProfileButton } from '@/components/ProfileButton';
import { useWeather } from '@/hooks/useWeather';
import { localSuggest, type SuggestedOutfit } from '@/services/stylist';
import { weatherEmoji, weatherLabel } from '@/services/weather';
import { useStore } from '@/store/useStore';
import { getArchetype } from '@/theme';
import { font, glass, iridescent, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
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
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
  /** Koyu zemin (hero) üstünde kullanılacaksa açık renklere geçer */
  onDark?: boolean;
  loading?: boolean;
  /** İnce çizgi ikon — emoji YERİNE (bkz. dosya başındaki not) */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
}) {
  const solid = variant === 'solid';
  const fg = solid
    ? onDark
      ? luxe.primary
      : luxe.onPrimary
    : onDark
      ? luxe.onDark
      : luxe.primary;
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
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
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
  return (
    <View style={[styles.glassCard, tint && styles.glassCardTint, style]}>
      {/*
        Hacim (3B) hissi: köşegen bir ışık geçişi — sol üstte aydınlık, sağ
        altta tona çalan. Kartın KENDİ zemini değil AYRI katman ve kırpma
        yerine aynı `borderRadius` veriliyor; gölge veren görünüme
        `overflow: 'hidden'` eklenince Android'de çocuklar çizilmiyor.
      */}
      <LinearGradient
        colors={
          tint
            ? ['rgba(255,255,255,0.94)', 'rgba(229,221,242,0.5)']
            : ['rgba(255,255,255,0.97)', 'rgba(220,235,236,0.34)']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.cardSheen}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

export default function Today() {
  const { profile, items, outfits, selfies, plans, setPlan, clearPlan, wearOutfit, logWear, addOutfit } =
    useStore();
  const { week, todayWeather, loading, error, useDeviceLocation, useCity } = useWeather();
  const { width } = useWindowDimensions();
  /*
    Modallar KENDİ güvenli alanını yönetmeli: `edgeToEdgeEnabled` ile
    uygulama sistem çubuklarının ARKASINA çiziyor, tam ekran modal
    SafeAreaView'ın dışında kalıyor ve içerik alt çubuğun altına giriyor.
  */
  const insets = useSafeAreaInsets();
  /*
    Klavye AÇIKKEN `insets.bottom` EKLENMEZ: KeyboardAvoidingView'ın eklediği
    klavye yüksekliği alt çubuğu zaten kapsıyor, üstüne inset binince arada
    boşluk kalıyor.
  */
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const [suggestion, setSuggestion] = useState<SuggestedOutfit | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'kombin' | 'selfie'>('kombin');
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
  /*
    Güne selfie de planlanabiliyor. Selfie bir kombine bağlıysa parçalar
    oradan geliyor — böylece "bugün bunu giydim" giyim kaydını doğru tutuyor.
  */
  const planSelfie = selectedPlan?.selfieId
    ? selfies.find((sf) => sf.id === selectedPlan.selfieId)
    : undefined;
  const selfieOutfit = planSelfie?.outfitId
    ? outfits.find((o) => o.id === planSelfie.outfitId)
    : undefined;
  const heroOutfit = planOutfit ?? selfieOutfit;
  const planItems = (heroOutfit?.itemIds ?? selectedPlan?.itemIds ?? [])
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
    plans.some((p) => p.date === d && (p.outfitId || p.selfieId || p.itemIds?.length)),
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
            const planned = plans.some(
              (p) => p.date === date && (p.outfitId || p.selfieId || p.itemIds?.length),
            );
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
                  <FinBlob shadow color={luxe.primaryContainer} gradient={iridescent.soft} />
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
        {planItems.length || planSelfie ? (
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
                disabled={!heroOutfit}
                onPress={() =>
                  heroOutfit &&
                  router.push({ pathname: '/outfit/[id]', params: { id: heroOutfit.id } })
                }
              >
                {planSelfie ? (
                  /* Gerçek insan fotoğrafı — `cover` kalabilir (bkz. AGENTS.md). */
                  <Image
                    source={{ uri: planSelfie.imageUri }}
                    style={{ width: heroSize, height: heroSize }}
                    contentFit="cover"
                  />
                ) : heroOutfit ? (
                  <OutfitCollage
                    items={planItems}
                    size={heroSize}
                    layout={heroOutfit.layout}
                    frame={heroOutfit.canvasFrame}
                    cropToContent={heroOutfit.cropToContent}
                  />
                ) : (
                  <OutfitCollage items={planItems} size={heroSize} />
                )}
              </Pressable>

              {/*
                Perde paletin koyu mor tonunda: nötr siyah/gri beyaz kolajın
                üstünde görüntüyü çamurlaştırıyor, bu ton çevirmiyor.
              */}
              <LinearGradient
                colors={[
                  'transparent',
                  `rgba(${luxe.scrimRgb},0.24)`,
                  `rgba(${luxe.scrimRgb},0.62)`,
                ]}
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
                  {planOutfit?.name ??
                    planSelfie?.note ??
                    (planSelfie ? 'Selfie' : `${planItems.length} parça`)}
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
                  {isToday && heroOutfit ? (
                    <LuxeButton
                      onDark
                      title="Bugün bunu giydim"
                      onPress={() => {
                        wearOutfit(heroOutfit.id, today);
                        clearPlan(today);
                      }}
                    />
                  ) : null}
                  {isToday && !heroOutfit && selectedPlan?.itemIds?.length ? (
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
              <LuxeButton variant="outline" icon="sparkles-outline" title="Bana öner" onPress={shuffle} />
            </View>
          </GlassCard>
        )}

        {/* Stilistin önerisi */}
        {suggestion && suggestedItems.length ? (
          <GlassCard tint style={{ marginTop: 24 }}>
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
              <LuxeButton variant="outline" icon="refresh-outline" title="Başka öner" onPress={shuffle} />
              <LuxeButton variant="outline" title="Vazgeç" onPress={() => setSuggestion(null)} />
            </View>
          </GlassCard>
        ) : null}

        {/* Stilistin yorumu */}
        <GlassCard style={{ marginTop: 30 }}>
          <View style={styles.insightGlow} pointerEvents="none" />
          <View style={styles.insightHead}>
            <Ionicons name="sparkles-outline" size={20} color={luxe.primary} />
            {/* Buraya dokunmak da şehir değiştirmeyi açar. */}
            {todayWeather ? (
              <Pressable
                onPress={() => setAskCity(true)}
                hitSlop={6}
                style={({ pressed }) => [{ flexShrink: 1 }, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.insightMeta} numberOfLines={1}>
                  {weatherEmoji(todayWeather.weatherCode)} {profile.city} ·{' '}
                  {weatherLabel(todayWeather.weatherCode)} {todayWeather.tempMax}°/
                  {todayWeather.tempMin}°
                </Text>
              </Pressable>
            ) : null}
          </View>
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

        </GlassCard>

        {/* Haftanın doluluğu */}
        <GlassCard style={{ marginTop: 24 }}>
          <View style={styles.progressHead}>
            <Text style={luxeType.label}>Haftanın doluluğu</Text>
            <Text style={styles.progressValue}>{Math.round((plannedDays / 7) * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            {/* Tam doygun geçiş: aksanın tek sahnesi burası. */}
            <LinearGradient
              colors={iridescent.full}
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
        <GlassCard tint style={{ marginTop: 24 }}>
          <View style={styles.insightGlow} pointerEvents="none" />
          <Ionicons name="sparkles-outline" size={20} color={luxe.primary} />
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
          <GlassCard style={{ marginTop: 24, alignItems: 'center' }}>
            <Ionicons name="shirt-outline" size={30} color={luxe.primarySoft} />
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

      {/*
        Şehir değiştirme PENCEREDE: form daha önce aşağıdaki kartın içinde
        açılıyordu, rozete dokunan kullanıcı ekranda hiçbir şey görmüyordu.
      */}
      <Modal
        visible={askCity}
        animationType="slide"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setAskCity(false)}
      >
        {/* `behavior="padding"` HER İKİ platformda da şart: edge-to-edge iken
            sistem pencereyi klavye için yeniden boyutlandırmıyor. */}
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <Pressable style={styles.cityWrap} onPress={() => setAskCity(false)}>
            <Pressable
              style={[
                styles.cityCard,
                { paddingBottom: 22 + (keyboardUp ? 0 : insets.bottom) },
              ]}
              onPress={() => {}}
            >
            <View style={styles.modalHead}>
              <Text style={luxeType.headline}>Şehir değiştir</Text>
              <Pressable
                onPress={() => setAskCity(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.chipText}>Kapat</Text>
              </Pressable>
            </View>
            {todayWeather ? (
              <Text style={[luxeType.caption, { marginBottom: 14 }]}>
                Şu an: {weatherEmoji(todayWeather.weatherCode)} {profile.city} ·{' '}
                {weatherLabel(todayWeather.weatherCode)} {todayWeather.tempMax}°/
                {todayWeather.tempMin}°
              </Text>
            ) : null}
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
                <View style={styles.btnRow}>
                  <Ionicons name="navigate-outline" size={15} color={luxe.primary} />
                  <Text style={styles.linkBtnText}>Konumumu kullan</Text>
                </View>
              )}
            </Pressable>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Kombin seçici */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { paddingBottom: 22 + insets.bottom }]}>
            <View style={styles.modalHead}>
              {/* Kombin ve selfie YAN YANA: gün planına ikisi de atanabiliyor. */}
              <View style={styles.tabRow}>
                {(['kombin', 'selfie'] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setPickerTab(t)}
                    style={[styles.tab, pickerTab === t && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, pickerTab === t && styles.tabTextActive]}>
                      {t === 'kombin' ? 'Kombin seç' : 'Selfie seç'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => setPickerOpen(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.chipText}>Kapat</Text>
              </Pressable>
            </View>
            <ScrollView>
              {pickerTab === 'selfie' ? (
                selfies.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Ionicons name="camera-outline" size={30} color={luxe.primarySoft} />
                    <Text style={[luxeType.headlineItalic, { marginTop: 10 }]}>
                      Henüz selfie yok
                    </Text>
                    <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>
                      Gardırop sekmesindeki Selfie'ler bölümünden ekleyebilirsin.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.outfitGrid}>
                    {selfies.map((sf) => (
                      <Pressable
                        key={sf.id}
                        onPress={() => {
                          setPlan({ date: selectedDate, selfieId: sf.id });
                          setPickerOpen(false);
                        }}
                        style={{ alignItems: 'center', width: 130 }}
                      >
                        {/* Gerçek insan fotoğrafı — `cover` (bkz. AGENTS.md). */}
                        <Image
                          source={{ uri: sf.imageUri }}
                          style={styles.selfieThumb}
                          contentFit="cover"
                        />
                        <Text style={[luxeType.caption, { marginTop: 6 }]} numberOfLines={1}>
                          {sf.note ||
                            new Date(`${sf.date}T12:00:00`).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )
              ) : outfits.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Ionicons name="color-palette-outline" size={30} color={luxe.primarySoft} />
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
    textShadowColor: `rgba(${luxe.scrimRgb},0.55)`,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },

  // Cam kartlar
  glassCard: {
    borderRadius: luxeRadius.lg,
    /*
      Zemin OPAK: yarı saydamken gölge (elevation) eklenemiyordu — Android'de
      gölge tabakası kartın içine beyaz bir dikdörtgen olarak sızıyor
      (cihazda görüldü). Derinlik için opak zemin + yayvan gölge şart.
    */
    backgroundColor: '#FFFDFD',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    padding: 22,
    overflow: 'hidden',
    // Gölge HİYERARŞİK, temadan: hero > kart > gün kartı (bkz. luxeShadow)
    ...luxeShadow.card,
  },
  glassCardTint: { backgroundColor: '#F2EFF7' },
  /** Hacim veren ışık geçişi — kartla aynı yuvarlaklık, kırpma gerekmiyor. */
  cardSheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: luxeRadius.lg,
  },
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

  insightHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  insightMeta: {
    flexShrink: 1,
    fontFamily: font.bodyMedium,
    fontSize: 11.5,
    color: luxe.outline,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  chip: {
    borderRadius: luxeRadius.pill,
    backgroundColor: 'rgba(217,212,204,0.42)',
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
  sectionTitle: { marginTop: 26, marginBottom: -10, fontSize: 19, lineHeight: 26 },

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
  dayName: {
    fontFamily: font.label,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.outline,
  },
  dayNum: { fontFamily: font.display, fontSize: 17, lineHeight: 21, color: luxe.ink },
  /*
    Tabular rakam: orantılı rakamlarla gün gün farklı genişlikte çıkıp
    şeritte hizasız duruyordu.
  */
  dayTemp: {
    fontFamily: font.bodyMedium,
    fontSize: 10,
    color: luxe.inkSoft,
    fontVariant: ['tabular-nums'],
  },
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
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
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

  // Şehir penceresi
  /* Alttan açılan sayfa — dokunulan yere yakın ve tanıdık bir kalıp. */
  cityWrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  cityCard: {
    backgroundColor: luxe.bg,
    borderTopLeftRadius: luxeRadius.xl,
    borderTopRightRadius: luxeRadius.xl,
    padding: 22,
  },

  // Seçici sekmeleri
  tabRow: { flexDirection: 'row', gap: 8, flexShrink: 1 },
  tab: {
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: glass.fill,
  },
  tabActive: { backgroundColor: luxe.primaryContainer },
  tabText: { fontFamily: font.bodyMedium, fontSize: 13, color: luxe.outline },
  tabTextActive: { color: luxe.primaryDeep },
  selfieThumb: { width: 130, height: 130, borderRadius: luxeRadius.md },

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
