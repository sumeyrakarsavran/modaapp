import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { colors, spacing, type } from '@/theme';

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Halka (donut) grafik — react-native-svg ile, ek kütüphanesiz. */
export function DonutChart({
  slices,
  size = 160,
  centerLabel,
  centerValue,
}: {
  slices: Slice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = 22;

  let angle = -90;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const sweep = (s.value / total) * 360;
      const path = arcPath(cx, cy, r, angle, angle + Math.min(sweep, 359.9));
      angle += sweep;
      return <Path key={i} d={path} stroke={s.color} strokeWidth={strokeW} fill="none" strokeLinecap="butt" />;
    });

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {total === 0 ? (
          <Circle cx={cx} cy={cy} r={r} stroke={colors.border} strokeWidth={strokeW} fill="none" />
        ) : (
          <G>{arcs}</G>
        )}
      </Svg>
      <View style={[styles.fill, styles.center]}>
        {centerValue ? <Text style={type.title}>{centerValue}</Text> : null}
        {centerLabel ? <Text style={type.tiny}>{centerLabel}</Text> : null}
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

export function Legend({ slices }: { slices: Slice[] }) {
  return (
    <View style={styles.legend}>
      {slices
        .filter((s) => s.value > 0)
        .map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={type.caption}>
              {s.label} · {s.value}
            </Text>
          </View>
        ))}
    </View>
  );
}

/** Yatay bar grafik. */
export function HBars({
  data,
  maxWidth = 220,
}: {
  data: { label: string; value: number; color?: string }[];
  maxWidth?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: spacing.sm }}>
      {data.map((d) => (
        <View key={d.label}>
          <View style={styles.barRow}>
            <Text style={[type.caption, { flex: 1 }]} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={[type.caption, { fontWeight: '700', color: colors.ink }]}>{d.value}</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${(d.value / max) * 100}%`,
                  backgroundColor: d.color ?? colors.aqua,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Basit ilerleme çubuğu (gardırop kullanım oranı). */
export function ProgressBar({
  ratio,
  color = colors.aqua,
  height = 12,
}: {
  ratio: number;
  color?: string;
  height?: number;
}) {
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2 }]}>
      <View
        style={{
          width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
          backgroundColor: color,
          height: '100%',
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3, gap: 8 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
});
