import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { font, iridescent, luxe, luxeType } from '@/theme/luxe';

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/**
 * Halka (donut) grafik — react-native-svg ile, ek kütüphanesiz.
 * Şerit bilerek İNCE: kalın halka pasta grafiği gibi ağırlaşıyordu, editoryal
 * duruş ince çizgi istiyor.
 */
export function DonutChart({
  slices,
  size = 168,
  centerLabel,
  centerValue,
}: {
  slices: Slice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const strokeW = 14;
  const r = size / 2 - strokeW / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;

  let angle = -90;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const sweep = (s.value / total) * 360;
      // Diliminler arasında ince bir nefes payı — sınırlar kendiliğinden okunuyor
      const gap = sweep > 8 ? 1.6 : 0;
      const path = arcPath(cx, cy, r, angle + gap, angle + Math.min(sweep, 359.9));
      angle += sweep;
      return (
        <Path key={i} d={path} stroke={s.color} strokeWidth={strokeW} fill="none" strokeLinecap="butt" />
      );
    });

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {total === 0 ? (
          <Circle cx={cx} cy={cy} r={r} stroke={luxe.surfaceMid} strokeWidth={strokeW} fill="none" />
        ) : (
          <G>{arcs}</G>
        )}
      </Svg>
      <View style={[styles.fill, styles.center]}>
        {centerValue ? <Text style={styles.donutValue}>{centerValue}</Text> : null}
        {centerLabel ? <Text style={styles.microLabel}>{centerLabel}</Text> : null}
      </View>
    </View>
  );
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Gösterge. `column` verilirse halkanın YANINDA dikey liste olur — ortalanmış
 * sarmalı satır hem yer yiyor hem de değerleri karşılaştırmayı zorlaştırıyor.
 */
export function Legend({ slices, column }: { slices: Slice[]; column?: boolean }) {
  const rows = slices.filter((s) => s.value > 0);
  if (column) {
    return (
      <View style={{ flex: 1, gap: 9 }}>
        {rows.map((s) => (
          <View key={s.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={styles.legendValue}>{s.value}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.legend}>
      {rows.map((s) => (
        <View key={s.label} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: s.color }]} />
          <Text style={luxeType.caption}>{s.label}</Text>
          <Text style={styles.legendValue}>{s.value}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Yatay bar grafik. Sayılar serif — rapor havası rakamlardan geliyor.
 *
 * `gradient` verilirse EN UZUN bar iridesan geçişle dolar, kalanlar sakin
 * mürekkep tonunda kalır: aksan Bugün'deki gibi tek yerde ve bilgi taşıyor
 * (hangi kategori baskın), süs olarak dağılmıyor.
 */
export function HBars({
  data,
  gradient,
}: {
  data: { label: string; value: number; color?: string }[];
  gradient?: readonly [string, string, ...string[]];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: 12 }}>
      {data.map((d) => {
        const w = `${(d.value / max) * 100}%` as const;
        const lead = gradient && d.value === max;
        return (
          <View key={d.label}>
            <View style={styles.barRow}>
              <Text style={styles.barLabel} numberOfLines={1}>
                {d.label}
              </Text>
              <Text style={styles.barValue}>{d.value}</Text>
            </View>
            <View style={styles.barTrack}>
              {lead ? (
                <LinearGradient
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.barFill, { width: w }]}
                />
              ) : (
                <View
                  style={[styles.barFill, { width: w, backgroundColor: d.color ?? luxe.secondary }]}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** İlerleme çubuğu; `gradient` verilirse iridesan geçişle dolar. */
export function ProgressBar({
  ratio,
  color = luxe.primary,
  gradient,
  height = 6,
  track = luxe.surfaceMid,
}: {
  ratio: number;
  color?: string;
  /** En az iki durak — `expo-linear-gradient` tipi bunu şart koşuyor. */
  gradient?: readonly [string, string, ...string[]];
  height?: number;
  track?: string;
}) {
  const pct = `${Math.min(100, Math.max(0, ratio * 100))}%` as const;
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2, backgroundColor: track }]}>
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: pct, height: '100%', borderRadius: height / 2 }}
        />
      ) : (
        <View
          style={{ width: pct, backgroundColor: color, height: '100%', borderRadius: height / 2 }}
        />
      )}
    </View>
  );
}

/** Grafiklerde kullanılan iridesan geçiş — çağıranlar tema dosyasını bilmesin. */
export const chartGradient = iridescent.full;

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  donutValue: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: luxe.primary },
  microLabel: {
    fontFamily: font.label,
    fontSize: 8.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: luxe.outline,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 16,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  legendLabel: { flex: 1, fontFamily: font.body, fontSize: 13, color: luxe.inkSoft },
  legendValue: { fontFamily: font.display, fontSize: 13, color: luxe.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  barRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 5, gap: 8 },
  barLabel: { flex: 1, fontFamily: font.body, fontSize: 13, color: luxe.inkSoft },
  barValue: { fontFamily: font.display, fontSize: 15, color: luxe.ink },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: luxe.surfaceMid, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
