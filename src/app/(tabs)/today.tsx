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

import { BettaFish } from '@/components/BettaFish';
import { ItemThumb } from '@/components/ItemThumb';
import { OutfitCollage } from '@/components/OutfitCollage';
import { ProfileButton } from '@/components/ProfileButton';
import { useWeather } from '@/hooks/useWeather';
import { localSuggest, type SuggestedOutfit } from '@/services/stylist';
import { weatherEmoji, weatherLabel } from '@/services/weather';
import { useStore } from '@/store/useStore';
import { getArchetype } from '@/theme';
import { font, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
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
 * Havaya göre kısa giyim tavsiyesi — örnekteki "Style Forecast" metninin
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

/** Editoryal düğme — dolu (primary) ya da ana hatlı. */
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
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: onDark ? 'rgba(255,255,255,0.55)' : luxe.outlineSoft,
            },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
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

/** İnce, iki ucu sönümlenen ayraç (örnekteki `fin-divider`). */
function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={['transparent', luxe.primarySoft, 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[{ height: 1, opacity: 0.7 }, style]}
    />
  );
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

  /** Şehir arama alanı — hem ilk kurulumda hem "Değiştir"de aynı görünüm. */
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
      {/* Üst çubuk: avatar · marka · ayarlar */}
      <View style={styles.header}>
        <ProfileButton size={40} />
        <Text style={styles.wordmark}>BETTA</Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={8}
          style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
        >
          <Ionicons name="settings-outline" size={22} color={luxe.primary} />
        </Pressable>
      </View>
      <Divider />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Karşılama */}
        <Text style={luxeType.display}>Tekrar hoş geldin,</Text>
        <Text style={luxeType.displayItalic}>
          {profile.name || archetype?.styleName || 'Betta'}
        </Text>
        {archetype ? (
          <Text style={[luxeType.label, { marginTop: 8 }]}>
            {archetype.emoji} {archetype.styleName} · {archetype.fish}
          </Text>
        ) : null}
        <Divider style={{ marginTop: 18 }} />

        {/* Haftalık plan şeridi */}
        <Text style={[luxeType.label, styles.sectionLabel]}>Haftalık plan</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 20 }}
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
                <Text style={[styles.dayName, active && { color: luxe.onPrimary }]}>
                  {DAY_NAMES[d.getDay()]}
                </Text>
                <Text style={[styles.dayNum, active && { color: luxe.onPrimary }]}>
                  {d.getDate()}
                </Text>
                {w ? (
                  <>
                    <Text style={{ fontSize: 13 }}>{weatherEmoji(w.weatherCode)}</Text>
                    <Text style={[styles.dayTemp, active && { color: luxe.onPrimary }]}>
                      {w.tempMax}°
                      <Text
                        style={[
                          styles.dayTempMin,
                          active && { color: 'rgba(255,255,255,0.72)' },
                        ]}
                      >
                        {' '}
                        {w.tempMin}°
                      </Text>
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 13 }}> </Text>
                    <Text style={styles.dayTemp}> </Text>
                  </>
                )}
                <View
                  style={[
                    styles.planDot,
                    {
                      backgroundColor: planned
                        ? active
                          ? luxe.primaryContainer
                          : luxe.primary
                        : 'transparent',
                    },
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
            <View style={styles.heroArt}>
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
            </View>
            {/*
              Perde BORDO ve hafif: kahve tonu kolajı çamurlaştırıyordu, açık
              perde ise alt parçaları (ayakkabıyı) yutuyordu. Hafif bordo ile
              parçalar görünür kalıyor, beyaz yazı da okunuyor.
            */}
            <LinearGradient
              colors={['transparent', 'rgba(94,20,40,0.26)', 'rgba(94,20,40,0.62)']}
              locations={[0.34, 0.6, 1]}
              style={styles.heroShade}
              pointerEvents="none"
            />
            {/*
              Etiket görselin SOL ÜST köşesinde; satır sarmalı ŞART, çünkü
              `alignSelf: 'flex-start'` ile rozet metinden dar ölçülüp yazıyı
              soldan kırpıyordu ("...OMBİNİ").
            */}
            <View style={styles.heroTag}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText} numberOfLines={1}>
                  {selectedLabel}
                </Text>
              </View>
            </View>
            <View style={styles.heroBody}>
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
          <View style={styles.heroEmpty}>
            <Text style={[luxeType.label, { color: luxe.primary }]}>{selectedLabel}</Text>
            <Text style={[luxeType.headline, { marginTop: 6 }]}>Bu gün için plan yok</Text>
            <Text style={[luxeType.body, { marginTop: 6 }]}>
              Kombinlerinden birini seç ya da gardırobundan sana bir öneri çıkaralım.
            </Text>
            <View style={styles.rowWrap}>
              <LuxeButton title="Kombinlerimden seç" onPress={() => setPickerOpen(true)} />
              <LuxeButton variant="outline" title="🎲 Bana öner" onPress={shuffle} />
            </View>
          </View>
        )}

        {/* Stilistin önerisi */}
        {suggestion && suggestedItems.length ? (
          <View style={[styles.card, styles.cardAccent]}>
            <Text style={[luxeType.label, { color: luxe.primary }]}>Stilistin önerisi</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginTop: 12 }}
            >
              {suggestedItems.map((it) => (
                <ItemThumb key={it.id} item={it} size={84} showName />
              ))}
            </ScrollView>
            <Text style={[luxeType.body, { marginTop: 12 }]}>{suggestion.reason}</Text>
            <View style={styles.rowWrap}>
              <LuxeButton title="Bugüne planla" onPress={saveSuggestionAsOutfit} />
              <LuxeButton variant="outline" title="🎲 Başka öner" onPress={shuffle} />
              <LuxeButton variant="outline" title="Vazgeç" onPress={() => setSuggestion(null)} />
            </View>
          </View>
        ) : null}

        {/* Stil raporu (hava durumu) */}
        <View style={styles.card}>
          <View style={styles.forecastHead}>
            <Text style={{ fontSize: 30 }}>
              {todayWeather ? weatherEmoji(todayWeather.weatherCode) : '🌤️'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={luxeType.label}>Stil raporu</Text>
              {/*
                Derece ve şehir AYRI satırlarda: tek satıra sıkıştırınca
                Playfair'in geniş rakamlarıyla sarıp "Değiştir" düğmesine
                giriyordu.
              */}
              {hasLocation && todayWeather ? (
                <>
                  <Text style={[luxeType.headline, { fontSize: 20 }]} numberOfLines={1}>
                    {todayWeather.tempMax}° / {todayWeather.tempMin}°
                  </Text>
                  <Text style={luxeType.caption} numberOfLines={1}>
                    {weatherLabel(todayWeather.weatherCode)}
                    {profile.city ? ` · ${profile.city}` : ''}
                  </Text>
                </>
              ) : (
                <Text style={[luxeType.headline, { fontSize: 20 }]}>Hava durumu</Text>
              )}
            </View>
            {hasLocation && todayWeather ? (
              <Pressable
                onPress={() => setAskCity((v) => !v)}
                hitSlop={6}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.chipText}>Değiştir</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[luxeType.body, { marginTop: 14 }]}>{styleAdvice(todayWeather)}</Text>

          {/* Konum yoksa: şehir arama + konum izni */}
          {!hasLocation || (askCity && !todayWeather) ? (
            <View style={{ marginTop: 14 }}>
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

          {/* Konum varken "Değiştir" */}
          {askCity && hasLocation && todayWeather ? (
            <View style={{ marginTop: 14 }}>{cityForm('Yeni şehir')}</View>
          ) : null}
        </View>


        {/* AI stilist */}
        <View style={styles.stylist}>
          <View style={styles.stylistGlow} pointerEvents="none" />
          <Text style={luxeType.headline}>AI Stilist'e danış</Text>
          <Text style={[luxeType.body, { marginTop: 8 }]}>
            Gardırobundaki parçalardan bugünkü enerjine uyanları seçmesi için sor:
            "Yarın toplantım var, ne giysem?"
          </Text>
          <View style={styles.stylistRow}>
            <LuxeButton title="Sohbete başla ✨" onPress={() => router.push('/stylist')} />
            <BettaFish size={52} color={luxe.primarySoft} />
          </View>
        </View>

        {/* Gardırop boşsa */}
        {activeItems.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 34 }}>🐟</Text>
            <Text style={[luxeType.headline, { marginTop: 8 }]}>Gardırobun bomboş</Text>
            <Text style={[luxeType.body, { textAlign: 'center', marginTop: 6 }]}>
              Önce Gardırop sekmesinden birkaç parça ekle, akvaryumu dolduralım.
            </Text>
            <LuxeButton
              title="Parça ekle"
              onPress={() => router.push('/item/new')}
              style={{ marginTop: 14 }}
            />
          </View>
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
                  <Text style={{ fontSize: 34 }}>🎨</Text>
                  <Text style={[luxeType.headline, { marginTop: 8 }]}>Henüz kombin yok</Text>
                  <Text style={[luxeType.body, { textAlign: 'center', marginTop: 6 }]}>
                    Stüdyo'dan ilk kombinini oluştur.
                  </Text>
                  <LuxeButton
                    title="Stüdyoya git"
                    style={{ marginTop: 14 }}
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
                        <Text style={[luxeType.caption, { marginTop: 4 }]} numberOfLines={1}>
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
    paddingBottom: 12,
  },
  wordmark: {
    fontFamily: font.display,
    fontSize: 22,
    letterSpacing: 4,
    color: luxe.primary,
  },
  container: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 48 },
  sectionLabel: { marginTop: 26, marginBottom: 10 },

  // Hafta şeridi
  day: {
    width: 64,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: luxeRadius.md,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    gap: 2,
  },
  dayActive: { backgroundColor: luxe.primary, borderColor: luxe.primary },
  dayName: { fontFamily: font.label, fontSize: 10.5, letterSpacing: 0.8, color: luxe.outline },
  dayNum: { fontFamily: font.headline, fontSize: 18, color: luxe.ink },
  dayTemp: { fontFamily: font.bodyMedium, fontSize: 11, color: luxe.ink },
  dayTempMin: { color: luxe.outline },
  planDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },

  // Hero
  /** Yalnızca gölge — kırpma YOK (bkz. hero JSX'indeki not). */
  hero: { marginTop: 18, borderRadius: luxeRadius.xl, backgroundColor: luxe.surface, ...luxeShadow.hero },
  /** Yalnızca kırpma — gölge YOK. */
  heroClip: { flex: 1, borderRadius: luxeRadius.xl, overflow: 'hidden' },
  heroArt: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  heroShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20 },
  /*
    Perde bilerek HAFİF (kombin görünsün diye), o yüzden beyaz yazı yer yere
    açık zemine denk geliyor. Perdeyi koyulaştırmak yerine yazıya gölge:
    okunurluk geliyor, kolaj kararmıyor.
  */
  heroShadowText: {
    textShadowColor: 'rgba(94,20,40,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  heroTag: { position: 'absolute', top: 16, left: 16, flexDirection: 'row' },
  heroPill: {
    /*
      Şeftali ama YARI SAYDAM: dolu renk rozeti kolajdan koparıyor, saydam
      beyaz ise açık zeminde kayboluyordu. Bu ikisinin arası.
    */
    backgroundColor: 'rgba(255,218,185,0.62)',
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroPillText: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: luxe.primaryDeep,
  },
  heroSub: { fontFamily: font.body, fontSize: 13, color: luxe.onDarkSoft, marginTop: 4 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  heroEmpty: {
    marginTop: 18,
    borderRadius: luxeRadius.xl,
    backgroundColor: luxe.surfaceLow,
    borderWidth: 1,
    borderColor: luxe.primaryContainer,
    padding: 22,
  },

  // Kartlar
  card: {
    marginTop: 18,
    borderRadius: luxeRadius.lg,
    backgroundColor: luxe.surface,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    padding: 18,
    ...luxeShadow.card,
  },
  cardAccent: { borderColor: luxe.primarySoft, backgroundColor: luxe.surfaceLow },
  forecastHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  // AI stilist
  stylist: {
    marginTop: 18,
    borderRadius: luxeRadius.xl,
    backgroundColor: luxe.surfaceMid,
    borderWidth: 1,
    borderColor: luxe.primaryContainer,
    padding: 22,
    overflow: 'hidden',
  },
  stylistGlow: {
    position: 'absolute',
    right: -60,
    top: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: luxe.primaryContainer,
    opacity: 0.45,
  },
  stylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },

  // Düğme
  btn: {
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: font.label, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },

  chip: {
    borderRadius: luxeRadius.pill,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontFamily: font.label,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: luxe.primary,
  },

  // Şehir formu
  cityRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    borderRadius: luxeRadius.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontFamily: font.body,
    fontSize: 14.5,
    color: luxe.ink,
    backgroundColor: luxe.bg,
  },
  linkBtn: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4 },
  linkBtnText: { fontFamily: font.bodyMedium, fontSize: 14, color: luxe.primary },
  errorText: { fontFamily: font.body, fontSize: 12.5, color: luxe.danger, marginTop: 6 },

  // Kombin seçici
  modalWrap: { flex: 1, backgroundColor: luxe.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: luxe.bg,
    borderTopLeftRadius: luxeRadius.xl,
    borderTopRightRadius: luxeRadius.xl,
    padding: 20,
    maxHeight: '75%',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  outfitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 24 },
});
