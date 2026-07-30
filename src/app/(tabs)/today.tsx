import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BettaFish, Wave } from '@/components/BettaFish';
import { ItemThumb } from '@/components/ItemThumb';
import { ProfileButton } from '@/components/ProfileButton';
import { OutfitCollage } from '@/components/OutfitCollage';
import { Button, Card, Chip, EmptyState, SectionTitle } from '@/components/UI';
import { useWeather } from '@/hooks/useWeather';
import { localSuggest, type SuggestedOutfit } from '@/services/stylist';
import { weatherEmoji, weatherLabel } from '@/services/weather';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';
import { todayISO } from '@/types';

const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export default function Today() {
  const { profile, items, outfits, plans, setPlan, clearPlan, wearOutfit, logWear, addOutfit } =
    useStore();
  const { week, todayWeather, loading, error, useDeviceLocation, useCity } = useWeather();

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

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Başlık */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.display}>Merhaba {profile.name || 'Betta'} 🐟</Text>
            <Text style={[type.caption, { marginTop: 2 }]}>
              {new Date().toLocaleDateString('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
          <ProfileButton size={44} />
        </View>
        <Wave width={340} />

        {/* Hava durumu */}
        <Card style={{ marginTop: spacing.lg }}>
          {hasLocation && todayWeather ? (
            <View style={styles.weatherRow}>
              <Text style={{ fontSize: 34 }}>{weatherEmoji(todayWeather.weatherCode)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={type.subtitle}>
                  {todayWeather.tempMax}° / {todayWeather.tempMin}° · {profile.city}
                </Text>
                <Text style={type.caption}>
                  {weatherLabel(todayWeather.weatherCode)}
                  {todayWeather.precipProb > 30 ? ` · %${todayWeather.precipProb} yağış` : ''}
                </Text>
              </View>
              <Chip label="Değiştir" onPress={() => setAskCity(true)} />
            </View>
          ) : askCity || !hasLocation ? (
            <View>
              <Text style={type.subtitle}>Hava durumuna göre kombin önerelim 🌊</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <TextInput
                  value={cityInput}
                  onChangeText={setCityInput}
                  placeholder="Şehir adı (örn. İstanbul)"
                  placeholderTextColor={colors.inkFaint}
                  style={styles.cityInput}
                  onSubmitEditing={async () => {
                    if (await useCity(cityInput)) setAskCity(false);
                  }}
                />
                <Button
                  small
                  title="Bul"
                  onPress={async () => {
                    if (await useCity(cityInput)) setAskCity(false);
                  }}
                />
              </View>
              <Button
                small
                variant="secondary"
                title="📍 Konumumu kullan"
                onPress={async () => {
                  if (await useDeviceLocation()) setAskCity(false);
                }}
                loading={loading}
                style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
              />
              {error ? (
                <Text style={[type.tiny, { color: colors.danger, marginTop: 6 }]}>{error}</Text>
              ) : null}
            </View>
          ) : null}
          {askCity && hasLocation ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <TextInput
                value={cityInput}
                onChangeText={setCityInput}
                placeholder="Yeni şehir"
                placeholderTextColor={colors.inkFaint}
                style={styles.cityInput}
                onSubmitEditing={async () => {
                  if (await useCity(cityInput)) setAskCity(false);
                }}
              />
              <Button
                small
                title="Bul"
                onPress={async () => {
                  if (await useCity(cityInput)) setAskCity(false);
                }}
              />
            </View>
          ) : null}
        </Card>

        {/* Haftalık şerit */}
        <SectionTitle title="Haftalık plan" style={{ marginTop: spacing.xl }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {weekDates.map((date, i) => {
              const d = new Date(`${date}T12:00:00`);
              const w = week[i];
              const planned = plans.some(
                (p) => p.date === date && (p.outfitId || p.itemIds?.length),
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
                  <Text style={[styles.dayName, active && { color: '#fff' }]}>
                    {DAY_NAMES[d.getDay()]}
                  </Text>
                  <Text style={[styles.dayNum, active && { color: '#fff' }]}>{d.getDate()}</Text>
                  {w ? (
                    <>
                      <Text style={{ fontSize: 13 }}>{weatherEmoji(w.weatherCode)}</Text>
                      <Text style={[styles.dayTemp, active && { color: '#fff' }]}>
                        {w.tempMax}°
                        <Text style={[styles.dayTempMin, active && { color: 'rgba(255,255,255,0.7)' }]}>
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
                      { backgroundColor: planned ? colors.coral : 'transparent' },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Seçili günün planı */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle
            title={
              selectedDate === today
                ? 'Bugünün kombini'
                : new Date(`${selectedDate}T12:00:00`).toLocaleDateString('tr-TR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
            }
            right={
              selectedWeather ? (
                <Text style={type.caption}>
                  {weatherEmoji(selectedWeather.weatherCode)} {selectedWeather.tempMax}°
                </Text>
              ) : undefined
            }
          />
          {planItems.length ? (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {planItems.map((it) => (
                    <ItemThumb key={it!.id} item={it!} size={84} showName />
                  ))}
                </View>
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                {selectedDate === today && planOutfit ? (
                  <Button
                    small
                    title="✔ Bugün bunu giydim"
                    onPress={() => {
                      wearOutfit(planOutfit.id, today);
                      clearPlan(today);
                    }}
                  />
                ) : null}
                {selectedDate === today && !planOutfit && selectedPlan?.itemIds?.length ? (
                  <Button
                    small
                    title="✔ Bugün bunu giydim"
                    onPress={() => {
                      logWear(selectedPlan.itemIds!, today);
                      clearPlan(today);
                    }}
                  />
                ) : null}
                <Button
                  small
                  variant="ghost"
                  title="Planı kaldır"
                  onPress={() => clearPlan(selectedDate)}
                />
              </View>
            </View>
          ) : (
            <View>
              <Text style={type.caption}>Bu gün için henüz plan yok.</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
                <Button small title="Kombinlerimden seç" onPress={() => setPickerOpen(true)} />
                <Button small variant="secondary" title="🎲 Bana öner" onPress={shuffle} />
              </View>
            </View>
          )}
        </Card>

        {/* Öneri kartı */}
        {suggestion && suggestedItems.length ? (
          <Card style={{ marginTop: spacing.lg, borderWidth: 2, borderColor: colors.aquaSoft }}>
            <SectionTitle title="🐠 Stilistin önerisi" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {suggestedItems.map((it) => (
                  <ItemThumb key={it.id} item={it} size={84} showName />
                ))}
              </View>
            </ScrollView>
            <Text style={[type.caption, { marginTop: spacing.md }]}>{suggestion.reason}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
              <Button small title="Bu güne planla" onPress={saveSuggestionAsOutfit} />
              <Button small variant="secondary" title="🎲 Başka öner" onPress={shuffle} />
              <Button small variant="ghost" title="Vazgeç" onPress={() => setSuggestion(null)} />
            </View>
          </Card>
        ) : null}

        {/* AI stilist */}
        <Card
          style={{ marginTop: spacing.lg, backgroundColor: colors.deep }}
          onPress={() => router.push('/stylist')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <BettaFish size={54} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={[type.subtitle, { color: '#fff' }]}>AI Stilist ile konuş</Text>
              <Text style={[type.caption, { color: 'rgba(255,255,255,0.75)' }]}>
                "Yarın toplantım var, ne giysem?" diye sor.
              </Text>
            </View>
            <Text style={{ color: colors.aqua, fontSize: 22 }}>›</Text>
          </View>
        </Card>

        {activeItems.length === 0 ? (
          <EmptyState
            title="Gardırobun bomboş"
            message="Önce Gardırop sekmesinden birkaç parça ekle, akvaryumu dolduralım."
            action={<Button small title="Parça ekle" onPress={() => router.push('/item/new')} />}
          />
        ) : null}
      </ScrollView>

      {/* Kombin seçici */}
      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <SectionTitle
              title="Kombin seç"
              right={<Chip label="Kapat" onPress={() => setPickerOpen(false)} />}
            />
            <ScrollView>
              {outfits.length === 0 ? (
                <EmptyState
                  emoji="🎨"
                  title="Henüz kombin yok"
                  message="Stüdyo'dan ilk kombinini oluştur."
                  action={
                    <Button
                      small
                      title="Stüdyoya git"
                      onPress={() => {
                        setPickerOpen(false);
                        router.push('/(tabs)/studio');
                      }}
                    />
                  }
                />
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
                        <OutfitCollage items={its} size={130} layout={o.layout} frame={o.canvasFrame} cropToContent={o.cropToContent} />
                        <Text style={[type.caption, { marginTop: 4 }]} numberOfLines={1}>
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
  container: { padding: spacing.lg, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cityInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontSize: 14.5,
    color: colors.ink,
    backgroundColor: colors.background,
  },
  day: {
    width: 64,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  dayActive: { backgroundColor: colors.deep, borderColor: colors.deep },
  dayName: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  dayNum: { fontSize: 17, fontWeight: '800', color: colors.ink },
  dayTemp: { fontSize: 11, fontWeight: '800', color: colors.ink },
  dayTempMin: { fontWeight: '600', color: colors.inkFaint },
  planDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  modalWrap: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '75%',
  },
  outfitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
});
