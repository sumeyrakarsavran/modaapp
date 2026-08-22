import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { chartGradient, DonutChart, HBars, Legend, ProgressBar } from '@/components/Charts';
import { BTN_PAD, FinBlob } from '@/components/FinBlob';
import { CARD_TRACK, GlassCard, ShapedCard } from '@/components/GlassCard';
import { ItemThumb } from '@/components/ItemThumb';
import { useStore } from '@/store/useStore';
import { font, luxe, luxeRadius, luxeType } from '@/theme/luxe';
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

/** Palet lekelerinin siluetleri — sırayla dönüyor, hepsi aynı olmasın. */
const PALETTE_SHAPES = ['fin', 'leaf', 'wave'] as const;

function daysAgo(iso: string): number {
  return Math.floor((Date.parse(todayISO()) - Date.parse(iso)) / 86400000);
}

/**
 * Kart başlığı — Bugün'deki "Stilistin yorumu" ile aynı kalıp: italik serif
 * başlık, sağda küçük harf aralıklı ek bilgi.
 */
function CardHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.cardHead}>
      <Text style={styles.cardTitle}>{title}</Text>
      {meta ? <Text style={luxeType.label}>{meta}</Text> : null}
    </View>
  );
}

/**
 * Etiket + rakam satırı — Bugün'deki "Haftanın doluluğu" başlığıyla aynı.
 * Rakam serif: raporun havası rakamlardan geliyor.
 */
function FigureHead({ label, value, onDark }: { label: string; value: string; onDark?: boolean }) {
  return (
    <View style={styles.figureHead}>
      <Text style={luxeType.label}>{label}</Text>
      <Text style={[styles.figureValue, onDark && { color: luxe.onDark }]}>{value}</Text>
    </View>
  );
}

/** Yatay parça şeridi — "en çok giyilenler" ve "uyuyanlar" aynı kalıbı kullanıyor. */
function ItemStrip({
  items,
  size,
  caption,
}: {
  items: any[];
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
      {items.map((i, idx) => (
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
      value: active.filter((it) => it.source === s.id).length,
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

  /* Artık sekme değil, profilden açılan bir ekran — başlıkta geri oku var. */
  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={{ paddingTop: 6 }}>
        <Ionicons name="arrow-back" size={22} color={luxe.primary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={luxeType.display}>Akvaryum</Text>
        <Text style={styles.subtitle}>Gardırobunun raporu</Text>
      </View>
    </View>
  );

  if (active.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: luxe.bg }} edges={['top']}>
        <Backdrop />
        {header}
        <View style={styles.empty}>
          <Ionicons name="stats-chart-outline" size={30} color={luxe.outlineSoft} />
          <Text style={[luxeType.headlineItalic, { marginTop: 12 }]}>Henüz veri yok</Text>
          <Text style={[luxeType.body, { textAlign: 'center', marginTop: 8 }]}>
            Gardırobuna parça ekleyip giydiklerini işaretledikçe rapor dolmaya başlar.
          </Text>
          <Pressable style={styles.cta} onPress={() => router.push('/item/new')}>
            <FinBlob shadow pad={BTN_PAD} variant="button" color={luxe.primary} />
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
      {header}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44, gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        {/*
          Kullanım — Bugün'deki "Haftanın doluluğu" kartının BİREBİR kalıbı:
          etiket + serif oran, iridesan çubuk, italik not.
        */}
        <GlassCard>
          <FigureHead label="Gardırop kullanımı" value={`%${Math.round(stats.usage * 100)}`} />
          <View style={{ marginTop: 16 }}>
            <ProgressBar ratio={stats.usage} gradient={chartGradient} height={6} track={CARD_TRACK} />
          </View>
          <Text style={styles.note}>
            Son 30 günde {stats.total} parçanın {stats.wornLast30} tanesini giydin.
          </Text>
        </GlassCard>

        {/*
          Üç sayı tek kartta, ince ayraçlarla. Üç ayrı kart üç ayrı çerçeve
          demekti; okuyan tek bakışta karşılaştırabilsin.
        */}
        <GlassCard style={styles.figureRow}>
          <View style={styles.cell}>
            <Text style={styles.cellFigure}>{stats.total}</Text>
            <Text style={styles.cellLabel}>Parça</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.cell}>
            <Text style={styles.cellFigure}>₺{stats.totalValue.toLocaleString('tr-TR')}</Text>
            <Text style={styles.cellLabel}>Değer</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.cell}>
            <Text style={styles.cellFigure}>
              {stats.avgCpw != null ? `₺${stats.avgCpw.toFixed(0)}` : '—'}
            </Text>
            <Text style={styles.cellLabel}>Giyim başına</Text>
          </View>
        </GlassCard>

        {/*
          Okyanus puanı — sayfanın tek vurgulu kartı (Bugün'deki AI kartı gibi).
          Rakam, Bugün'ün gün kartlarındaki YÜZGEÇ biçiminin içinde duruyor:
          aynı SVG yolu, aynı elle çizilmiş yamukluk. Marka biçimi burada da
          tekrar edince sayfa "grafik ekranı" değil, aynı elden çıkmış bir
          rapor gibi okunuyor.
        */}
        <ShapedCard tint style={styles.scoreCard}>
          <View style={{ flex: 1 }}>
            <Text style={luxeType.label}>Okyanus puanı</Text>
            <View style={{ marginTop: 14 }}>
              <ProgressBar
                ratio={stats.sustainability / 100}
                gradient={chartGradient}
                height={6}
                track={CARD_TRACK}
              />
            </View>
            <Text style={styles.note}>
              İkinci el, el yapımı ve sahip olduğunu giymek puanı yükseltir.
            </Text>
          </View>
          {/*
            Blob BEYAZ, iridesan değil: tint kartın lila zemininde pastel geçiş
            soluk kalıyordu (telefonda görüldü). Beyaz + gölge onu rapora
            basılmış bir mühür gibi öne çıkarıyor.
          */}
          <View style={styles.medallion}>
            <FinBlob color={luxe.surface} variant="pebble" shadow />
            <View style={styles.medallionText} pointerEvents="none">
              <Text style={styles.medallionValue}>{stats.sustainability}</Text>
              <Text style={styles.medallionMax}>/100</Text>
            </View>
          </View>
        </ShapedCard>

        {/* Kompozisyon — halka solda, gösterge sağda dikey liste */}
        <GlassCard>
          <CardHead title="Kompozisyon" meta="Nereden geldi" />
          <View style={styles.donutRow}>
            <DonutChart
              slices={stats.bySource}
              size={132}
              centerValue={String(stats.total)}
              centerLabel="PARÇA"
            />
            <Legend slices={stats.bySource} column />
          </View>
        </GlassCard>

        <GlassCard>
          <CardHead title="Kategoriler" />
          <HBars data={stats.byCategory.filter((c) => c.value > 0)} gradient={chartGradient} />
        </GlassCard>

        <GlassCard>
          <CardHead
            title="Renk paletin"
            meta={stats.byColor.length ? `${stats.byColor.length} ton` : undefined}
          />
          {/*
            Lekeler yuvarlak değil YÜZGEÇ biçiminde ve BOYLARI parça sayısına
            göre: palet böylece süs olmaktan çıkıp bir grafik oluyor — baskın
            tonlar tek bakışta büyük duruyor. Kutu boyu sabit, blob içinde
            ortalanıyor; yoksa sarmalanan satırlar tırtıklı görünüyor.
          */}
          <View style={styles.paletteRow}>
            {stats.byColor.map((c, idx) => {
              const t = c.count / stats.byColor[0].count;
              const d = Math.round(28 + t * 26);
              return (
                <View key={c.id} style={styles.paletteCell}>
                  <View style={styles.paletteSlot}>
                    <View style={{ width: d, height: d }}>
                      {/* Üç ayrı oran sırayla: lekeler aynı kalıptan çıkmış gibi durmasın */}
                      <FinBlob color={c.hex} variant={PALETTE_SHAPES[idx % PALETTE_SHAPES.length]} />
                    </View>
                  </View>
                  <Text style={styles.paletteCount}>{c.count}</Text>
                  <Text style={styles.paletteName} numberOfLines={1}>
                    {c.label}
                  </Text>
                </View>
              );
            })}
          </View>
          {stats.byColor.length >= 3 ? (
            <Text style={styles.note}>
              Baskın tonun {stats.byColor[0].label.toLocaleLowerCase('tr')} — kombinlerin bu renk
              etrafında kuruluyor.
            </Text>
          ) : null}
        </GlassCard>

        {stats.mostWorn.length ? (
          <GlassCard>
            <CardHead title="En çok giyilenler" />
            <ItemStrip
              items={stats.mostWorn}
              size={92}
              caption={(i, idx) =>
                `${idx + 1} · ${i.wearDates.length} kez${
                  i.price ? ` · ₺${(i.price / i.wearDates.length).toFixed(0)}/giyim` : ''
                }`
              }
            />
          </GlassCard>
        ) : null}

        {stats.neglected.length ? (
          <GlassCard>
            <CardHead title="Dolapta uyuyanlar" meta="45+ gün" />
            <Text style={[styles.note, { marginTop: 0, marginBottom: 14 }]}>
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
          </GlassCard>
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
    gap: 14,
  },
  subtitle: {
    fontFamily: font.body,
    fontStyle: 'italic',
    fontSize: 13,
    color: luxe.outline,
    marginTop: -2,
  },

  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 16 },
  /** Bugün'deki kart başlıklarıyla aynı: italik serif. */
  cardTitle: {
    flex: 1,
    fontFamily: font.headlineItalic,
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 26,
    color: luxe.primary,
  },
  figureHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  figureValue: { fontFamily: font.display, fontSize: 20, color: luxe.primary },
  /** Çubuk altındaki açıklama — Bugün'de de italik. */
  note: { ...luxeType.caption, fontStyle: 'italic', marginTop: 12 },

  /*
    Hücreler ÜSTTEN hizalanıyor: ortadan hizalanınca iki satıra saran etiket
    ("giyim başına") kendi rakamını yukarı itiyor ve üç rakam aynı çizgide
    durmuyordu. Ayraç da bu yüzden sabit boyda.
  */
  figureRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { flex: 1, alignItems: 'center', gap: 5 },
  cellFigure: { fontFamily: font.display, fontSize: 19, lineHeight: 24, color: luxe.primary },
  /** Etiket tek satıra sığsın diye ölçekten biraz dar — harf aralığı da kısık. */
  cellLabel: {
    fontFamily: font.label,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: luxe.outline,
    textAlign: 'center',
  },
  divider: { width: 1, height: 42, backgroundColor: luxe.outlineSoft },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },

  /** Puan madalyonu — kart iki sütun: solda ölçek, sağda biçim. */
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  medallion: { width: 104, height: 104 },
  medallionText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionValue: { fontFamily: font.display, fontSize: 28, lineHeight: 32, color: luxe.primary },
  medallionMax: { fontFamily: font.body, fontSize: 10, color: luxe.outline, marginTop: -2 },

  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  paletteCell: { alignItems: 'center', width: 52, gap: 3 },
  /** Sabit yuva: blob boyu değişse de satırlar aynı hizada kalıyor. */
  paletteSlot: { height: 56, justifyContent: 'center', alignItems: 'center' },
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
    paddingVertical: 11 + BTN_PAD,
    paddingHorizontal: 18 + BTN_PAD,
  },
  ctaText: {
    fontFamily: font.label,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: luxe.onPrimary,
  },
});
