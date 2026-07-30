import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DonutChart, HBars, Legend, ProgressBar } from '@/components/Charts';
import { ItemThumb } from '@/components/ItemThumb';
import { ProfileButton } from '@/components/ProfileButton';
import { Button, Card, EmptyState, SectionTitle } from '@/components/UI';
import { useStore } from '@/store/useStore';
import { colors, spacing, type } from '@/theme';
import { CATEGORIES, ITEM_COLORS, SOURCES, todayISO } from '@/types';

function daysAgo(iso: string): number {
  return Math.floor((Date.parse(todayISO()) - Date.parse(iso)) / 86400000);
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

    const bySource = SOURCES.map((s) => ({
      label: s.label,
      value: active.filter((i) => i.source === s.id).length,
      color: s.color,
    }));

    const byCategory = CATEGORIES.map((c) => ({
      label: `${c.emoji} ${c.label}`,
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
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.headRow}>
          <Text style={[type.display, { flex: 1 }]}>Akvaryum 📊</Text>
          <ProfileButton />
        </View>
        <EmptyState
          title="Henüz veri yok"
          message="Gardırobuna parça ekleyip giydiklerini işaretledikçe akvaryumun canlanacak."
          action={<Button small title="+ Parça ekle" onPress={() => router.push('/item/new')} />}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.display}>Akvaryum 📊</Text>
            <Text style={type.caption}>Gardırobunun sağlık raporu</Text>
          </View>
          <ProfileButton />
        </View>

        {/* Kullanım oranı */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle
            title="Gardırop kullanımı"
            right={<Text style={[type.title, { color: colors.aquaDark }]}>%{Math.round(stats.usage * 100)}</Text>}
          />
          <ProgressBar ratio={stats.usage} />
          <Text style={[type.tiny, { marginTop: 8 }]}>
            Son 30 günde {stats.total} parçanın {stats.wornLast30} tanesini giydin.
            {stats.usage < 0.3 ? ' Dolapta uyuyan balıklar var 🐟💤' : stats.usage > 0.6 ? ' Harika, akvaryum capcanlı! 🎉' : ''}
          </Text>
        </Card>

        {/* Özet kutuları */}
        <View style={styles.tiles}>
          <Card style={styles.tile}>
            <Text style={type.title}>{stats.total}</Text>
            <Text style={type.tiny}>aktif parça</Text>
          </Card>
          <Card style={styles.tile}>
            <Text style={type.title}>₺{stats.totalValue.toLocaleString('tr-TR')}</Text>
            <Text style={type.tiny}>gardırop değeri</Text>
          </Card>
          <Card style={styles.tile}>
            <Text style={[type.title, { color: colors.seagreen }]}>
              {stats.avgCpw != null ? `₺${stats.avgCpw.toFixed(0)}` : '—'}
            </Text>
            <Text style={type.tiny}>ort. giyim maliyeti</Text>
          </Card>
        </View>

        {/* Sürdürülebilirlik */}
        <Card style={{ marginTop: spacing.md, backgroundColor: colors.deep }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text style={{ fontSize: 34 }}>🌊</Text>
            <View style={{ flex: 1 }}>
              <Text style={[type.subtitle, { color: '#fff' }]}>Okyanus puanın: {stats.sustainability}/100</Text>
              <Text style={[type.tiny, { color: 'rgba(255,255,255,0.75)' }]}>
                İkinci el, el yapımı ve sahip olduklarını giymek puanı yükseltir.
              </Text>
            </View>
          </View>
          <ProgressBar ratio={stats.sustainability / 100} color={colors.seagreen} height={8} />
        </Card>

        {/* Kompozisyon */}
        <Card style={{ marginTop: spacing.md }}>
          <SectionTitle title="Gardırop kompozisyonu" />
          <DonutChart
            slices={stats.bySource}
            centerValue={String(stats.total)}
            centerLabel="parça"
          />
          <Legend slices={stats.bySource} />
        </Card>

        {/* Kategoriler */}
        <Card style={{ marginTop: spacing.md }}>
          <SectionTitle title="Kategorilere göre" />
          <HBars data={stats.byCategory.filter((c) => c.value > 0)} />
        </Card>

        {/* Renk paleti */}
        <Card style={{ marginTop: spacing.md }}>
          <SectionTitle title="Renk paletin" />
          <View style={styles.paletteRow}>
            {stats.byColor.map((c) => (
              <View key={c.id} style={{ alignItems: 'center', width: 52 }}>
                <View style={[styles.paletteDot, { backgroundColor: c.hex }]} />
                <Text style={type.tiny}>{c.label}</Text>
                <Text style={[type.tiny, { fontWeight: '800', color: colors.ink }]}>{c.count}</Text>
              </View>
            ))}
          </View>
          {stats.byColor.length >= 3 ? (
            <Text style={[type.tiny, { marginTop: spacing.sm }]}>
              En baskın rengin {stats.byColor[0].label.toLocaleLowerCase('tr')} — betta pulların bu tonda parlıyor ✨
            </Text>
          ) : null}
        </Card>

        {/* En çok giyilenler */}
        {stats.mostWorn.length ? (
          <Card style={{ marginTop: spacing.md }}>
            <SectionTitle title="En çok giyilenler 🏆" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {stats.mostWorn.map((i, idx) => (
                  <Pressable
                    key={i.id}
                    onPress={() => router.push({ pathname: '/item/[id]', params: { id: i.id } })}
                    style={{ alignItems: 'center', width: 92 }}
                  >
                    <ItemThumb item={i} size={92} />
                    <Text style={[type.tiny, { marginTop: 4 }]} numberOfLines={1}>
                      {idx + 1}. {i.name}
                    </Text>
                    <Text style={[type.tiny, { fontWeight: '800', color: colors.aquaDark }]}>
                      {i.wearDates.length} kez
                      {i.price ? ` · ₺${(i.price / i.wearDates.length).toFixed(0)}/giyim` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Card>
        ) : null}

        {/* Unutulanlar */}
        {stats.neglected.length ? (
          <Card style={{ marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.goldSoft }}>
            <SectionTitle title="Dolapta uyuyanlar 💤" />
            <Text style={[type.tiny, { marginBottom: spacing.sm }]}>
              45+ gündür giyilmediler. Bu hafta birini uyandır ya da arşivlemeyi düşün.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {stats.neglected.map((i) => (
                  <ItemThumb
                    key={i.id}
                    item={i}
                    size={76}
                    showName
                    onPress={() => router.push({ pathname: '/item/[id]', params: { id: i.id } })}
                  />
                ))}
              </View>
            </ScrollView>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tile: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  paletteDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 3,
  },
});
