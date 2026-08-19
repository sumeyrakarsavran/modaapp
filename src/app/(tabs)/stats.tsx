import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { chartGradient, DonutChart, HBars, Legend, ProgressBar } from '@/components/Charts';
import { ItemThumb } from '@/components/ItemThumb';
import { ProfileButton } from '@/components/ProfileButton';
import { useStore } from '@/store/useStore';
import { font, glass, luxe, luxeRadius, luxeType } from '@/theme/luxe';
import { CATEGORIES, ITEM_COLORS, SOURCES, todayISO } from '@/types';

/**
 * Halka grafiğin renk rampası.
 *
 * `SOURCES` renkleri pastel — haplarda doğru duruyor ama ince halka şeridinde
 * beyaz zemine karışıp okunmuyordu (telefonda görüldü). Grafik markanın
 * iridesan üçlüsünden türeyen bu rampayı kullanıyor; renk zaten yalnızca
 * altındaki göstergeye anahtar, kaynağın kendi rengiyle eşleşmesi şart değil.
 */
const RAMP = ['#1F6F78', '#6B4E9B', '#B93E7A', '#5FA3AA', '#9B8BC4', '#D98BB0'];

function daysAgo(iso: string): number {
  return Math.floor((Date.parse(todayISO()) - Date.parse(iso)) / 86400000);
}

/**
 * Rapor paneli — cam yüzey, gölgesiz.
 * ⚠️ `elevation` VERİLMİYOR: yarı saydam dolguyla birleşince Android gölgeyi
 * kartın içine beyaz bir dikdörtgen olarak sızdırıyor (Stüdyo'da görüldü).
 */
function Panel({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/** Bölüm başlığı: serif ad, sağda küçük harf aralıklı sayaç. */
function Head({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.head}>
      <Text style={styles.headTitle}>{title}</Text>
      {meta ? <Text style={styles.headMeta}>{meta}</Text> : null}
    </View>
  );
}

/** Yatay parça şeridi — "en çok giyilenler" ve "uyuyanlar" aynı kalıbı kullanıyor. */
function ItemStrip({
  items,
  size,
  caption,
}: {
  items: { id: string; name: string }[];
  size: number;
  /** Karonun altındaki tek satır — sıralama, sayı ya da maliyet. */
  caption: (item: any, index: number) => string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingTop: 2 }}
    >
      {items.map((i: any, idx) => (
        <Pressable
          key={i.id}
          onPress={() => router.push({ pathname: '/item/[id]', params: { id: i.id } })}
          style={{ width: size }}
        >
          <ItemThumb item={i} size={size} />
          <Text style={styles.stripName} numberOfLines={1}>
            {i.name}
          </Text>
          <Text style={styles.stripMeta} numberOfLines={1}>
            {caption(i, idx)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function Stats() {
  const items = useStore((s) => s.items);
  const active = items.filter((i) => !i.archived);

  const stats = useMemo(() => {
    const total = active.length;
    const wornLast30 = active.filter((i) =>
      i.wearDates.some((d) => daysAgo(d) <= 30),
    ).length;
    const usage = total ? wornLast30 / total : 0;

    const bySource = SOURCES.map((s, i) => ({
      label: s.label,
      value: active.filter((i) => i.source === s.id).length,
      color: RAMP[i % RAMP.length],
    }));

    const byCategory = CATEGORIES.map((c) => ({
      label: c.label,
      value: active.filter((i) => i.category === c.id).length,
    }));

    const byColor = ITEM_COLORS.map((c) => ({
      ...c,
      count: active.filter((i) => i.colorId === c.id).length,
    }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);

    const mostWorn = [...active]
      .filter((i) => i.wearDates.length > 0)
      .sort((a, b) => b.wearDates.length - a.wearDates.length)
      .slice(0, 5);

    const neglected = [...active]
      .filter(
        (i) =>
          i.wearDates.length === 0 ||
          Math.min(...i.wearDates.map(daysAgo)) > 45,
      )
      .slice(0, 6);

    const totalValue = active.reduce((s, i) => s + (i.price ?? 0), 0);
    const totalWears = active.reduce((s, i) => s + i.wearDates.length, 0);
    const avgCpw =
      totalWears > 0 ? active.reduce((s, i) => s + (i.price ?? 0), 0) / totalWears : undefined;

    // Sürdürülebilirlik: ikinci el/el yapımı/hediye oranı (%60) + kullanım (%40)
    const circular = total
      ? active.filter((i) => ['ikinciel', 'elyapimi', 'hediye', 'kiralik'].includes(i.source)).length / total
      : 0;
    const sustainability = Math.round((circular * 0.6 + usage * 0.4) * 100);

    return {
      total, usage, wornLast30, bySource, byCategory, byColor,
      mostWorn, neglected, totalValue, avgCpw, sustainability,
    };
  }, [active]);

  if (active.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
        <Backdrop />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={luxeType.display}>Akvaryum</Text>
          </View>
          <ProfileButton size={36} />
        </View>
        <View style={styles.empty}>
          <Ionicons name="stats-chart-outline" size={30} color={luxe.outlineSoft} />
          <Text style={[luxeType.headlineItalic, { marginTop: 12 }]}>Henüz veri yok</Text>
          <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>
            Gardırobuna parça ekleyip giydiklerini işaretledikçe rapor dolmaya başlar.
          </Text>
          <Pressable style={styles.cta} onPress={() => router.push('/item/new')}>
            <Ionicons name="add" size={14} color={luxe.onPrimary} />
            <Text style={styles.ctaText}>Parça ekle</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
      {/* Diğer sekmelerle aynı zemin */}
      <Backdrop />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={luxeType.display}>Akvaryum</Text>
          <Text style={styles.subtitle}>Gardırobunun raporu</Text>
        </View>
        <ProfileButton size={36} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ————— Kullanım ————— */}
        <Panel>
          <View style={styles.usageRow}>
            <Text style={styles.microLabel}>GARDIROP KULLANIMI</Text>
            <Text style={styles.bigFigure}>
              %{Math.round(stats.usage * 100)}
            </Text>
          </View>
          <ProgressBar ratio={stats.usage} gradient={chartGradient} height={6} />
          <Text style={[luxeType.caption, { marginTop: 10 }]}>
            Son 30 günde {stats.total} parçanın {stats.wornLast30} tanesini giydin.
          </Text>
        </Panel>

        {/*
          Üç sayı: kutu yerine ince ayraçlı tek satır. Üç ayrı kart, üç ayrı
          çerçeve demekti; rapor sayfası bunu tek nefeste okutuyor.
        */}
        <Panel style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.figureCell}>
            <Text style={styles.figure}>{stats.total}</Text>
            <Text style={styles.microLabel}>PARÇA</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.figureCell}>
            <Text style={styles.figure}>₺{stats.totalValue.toLocaleString('tr-TR')}</Text>
            <Text style={styles.microLabel}>DEĞER</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.figureCell}>
            <Text style={styles.figure}>
              {stats.avgCpw != null ? `₺${stats.avgCpw.toFixed(0)}` : '—'}
            </Text>
            <Text style={styles.microLabel}>GİYİM BAŞINA</Text>
          </View>
        </Panel>

        {/* ————— Okyanus puanı ————— */}
        <View style={styles.scoreCard}>
          <View style={styles.usageRow}>
            <Text style={[styles.microLabel, { color: luxe.onDarkSoft }]}>OKYANUS PUANI</Text>
            <Text style={[styles.bigFigure, { color: luxe.onDark }]}>
              {stats.sustainability}
              <Text style={styles.scoreMax}>/100</Text>
            </Text>
          </View>
          <ProgressBar
            ratio={stats.sustainability / 100}
            gradient={chartGradient}
            height={6}
            track="rgba(255,255,255,0.18)"
          />
          <Text style={styles.scoreNote}>
            İkinci el, el yapımı ve sahip olduğunu giymek puanı yükseltir.
          </Text>
        </View>

        {/* ————— Kompozisyon ————— */}
        <Panel>
          <Head title="Kompozisyon" meta="NEREDEN GELDİ" />
          <DonutChart
            slices={stats.bySource}
            centerValue={String(stats.total)}
            centerLabel="PARÇA"
          />
          <Legend slices={stats.bySource} />
        </Panel>

        {/* ————— Kategoriler ————— */}
        <Panel>
          <Head title="Kategoriler" />
          <HBars data={stats.byCategory.filter((c) => c.value > 0)} />
        </Panel>

        {/* ————— Renk paleti ————— */}
        <Panel>
          <Head
            title="Renk paletin"
            meta={stats.byColor.length ? `${stats.byColor.length} TON` : undefined}
          />
          <View style={styles.paletteRow}>
            {stats.byColor.map((c) => (
              <View key={c.id} style={styles.paletteCell}>
                <View style={[styles.paletteDot, { backgroundColor: c.hex }]} />
                <Text style={styles.paletteCount}>{c.count}</Text>
                <Text style={styles.paletteName} numberOfLines={1}>
                  {c.label}
                </Text>
              </View>
            ))}
          </View>
          {stats.byColor.length >= 3 ? (
            <Text style={[luxeType.caption, { marginTop: 12 }]}>
              Baskın tonun {stats.byColor[0].label.toLocaleLowerCase('tr')} — kombinlerin bu renk
              etrafında kuruluyor.
            </Text>
          ) : null}
        </Panel>

        {/* ————— En çok giyilenler ————— */}
        {stats.mostWorn.length ? (
          <Panel>
            <Head title="En çok giyilenler" />
            <ItemStrip
              items={stats.mostWorn}
              size={92}
              caption={(i, idx) =>
                `${idx + 1} · ${i.wearDates.length} kez${
                  i.price ? ` · ₺${(i.price / i.wearDates.length).toFixed(0)}/giyim` : ''
                }`
              }
            />
          </Panel>
        ) : null}

        {/* ————— Unutulanlar ————— */}
        {stats.neglected.length ? (
          <Panel>
            <Head title="Dolapta uyuyanlar" meta="45+ GÜN" />
            <Text style={[luxeType.caption, { marginBottom: 12 }]}>
              Bu hafta birini uyandır ya da arşivlemeyi düşün.
            </Text>
            <ItemStrip
              items={stats.neglected}
              size={78}
              caption={(i) =>
                i.wearDates.length
                  ? `${Math.min(...i.wearDates.map(daysAgo))} gün önce`
                  : 'hiç giyilmedi'
              }
            />
          </Panel>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  subtitle: {
    fontFamily: font.body,
    fontStyle: 'italic',
    fontSize: 13,
    color: luxe.outline,
    marginTop: -2,
  },

  panel: {
    backgroundColor: glass.fillStrong,
    borderRadius: luxeRadius.lg,
    borderWidth: 1,
    borderColor: glass.border,
    padding: 18,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 14 },
  headTitle: { flex: 1, fontFamily: font.headline, fontSize: 18, color: luxe.primary },
  headMeta: {
    fontFamily: font.label,
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: luxe.outline,
  },

  microLabel: {
    fontFamily: font.label,
    fontSize: 8.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.outline,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  /** Rapor havası rakamlardan geliyor: figürler serif. */
  bigFigure: { fontFamily: font.display, fontSize: 30, lineHeight: 34, color: luxe.primary },
  figureCell: { flex: 1, alignItems: 'center', gap: 4 },
  figure: { fontFamily: font.display, fontSize: 19, lineHeight: 24, color: luxe.primary },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: luxe.outlineSoft, marginVertical: 2 },

  /** Tek koyu yüzey — sayfadaki tek vurgu, o yüzden değerli. */
  scoreCard: {
    backgroundColor: luxe.primary,
    borderRadius: luxeRadius.lg,
    padding: 18,
  },
  scoreMax: { fontFamily: font.body, fontSize: 13, color: luxe.onDarkSoft },
  scoreNote: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: luxe.onDarkSoft,
    marginTop: 10,
  },

  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  paletteCell: { alignItems: 'center', width: 52, gap: 3 },
  paletteDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  paletteCount: { fontFamily: font.display, fontSize: 14, color: luxe.ink },
  paletteName: { fontFamily: font.body, fontSize: 10, color: luxe.outline },

  stripName: { fontFamily: font.bodyMedium, fontSize: 12, color: luxe.ink, marginTop: 6 },
  stripMeta: { fontFamily: font.body, fontSize: 10.5, color: luxe.outline, marginTop: 1 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    backgroundColor: luxe.primary,
    borderRadius: luxeRadius.pill,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  ctaText: {
    fontFamily: font.label,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: luxe.onPrimary,
  },
});
