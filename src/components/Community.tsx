import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BettaAvatar } from '@/components/BettaAvatar';
import { GarmentArt } from '@/components/GarmentArt';
import { CANVAS_BASE } from '@/components/OutfitCollage';
import { PERSONAS } from '@/data/community';
import { colors, getArchetype, radius, shadow, spacing, type } from '@/theme';
import type { CommunityPost, CommunityUser, GarmentSpec } from '@/types';

/** 'me' dahil kullanıcı bilgisi döndürür. */
export function resolveUser(
  userId: string,
  me: { name: string; username: string; archetypeId?: string; avatarUri?: string },
): CommunityUser {
  if (userId === 'me') {
    return {
      id: 'me',
      name: me.name || 'Ben',
      username: me.username || 'ben',
      bio: '',
      archetypeId: me.archetypeId ?? 'plakat',
      color: getArchetype(me.archetypeId)?.color ?? colors.aqua,
      avatarUri: me.avatarUri,
      followers: 0,
      isMe: true,
    };
  }
  return (
    PERSONAS.find((p) => p.id === userId) ?? {
      id: userId,
      name: userId,
      username: userId,
      bio: '',
      archetypeId: 'plakat',
      color: colors.aqua,
      followers: 0,
    }
  );
}

export function Avatar({
  user,
  size = 44,
  onPress,
}: {
  user: CommunityUser;
  size?: number;
  onPress?: () => void;
}) {
  const inner = (
    <BettaAvatar size={size} color={user.color} imageUri={user.avatarUri} />
  );
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

/** Kategori+renk speclerinden kolaj (başka kullanıcıların kombinleri için). */
export function SpecCollage({ garments, size = 200 }: { garments: GarmentSpec[]; size?: number }) {
  const shown = garments.slice(0, 4);
  const cell = size / 2 - 6;
  return (
    <View style={[styles.collage, { width: size, height: size }]}>
      <View style={styles.collageGrid}>
        {shown.map((g, i) => (
          <View key={i} style={[styles.collageCell, { width: cell, height: cell }]}>
            <GarmentArt category={g.category} subcategory={g.subcategory} colorId={g.colorId} size={cell * 0.8} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Tamamen esnek kolaj — kapsayıcısının genişliğini doldurur, asla taşmaz.
 * - Canvas/kombin düzeni (layout) varsa parçalar TAM oluşturulduğu gibi,
 *   yüzde konumlarla yerleştirilir (kare kutuya orantılı sığdırılır, kırpılmaz).
 * - Layout yoksa 2x2 ızgara kolaj (persona/eski gönderiler).
 */
export function FluidSpecCollage({
  garments,
  frame,
  cropToContent,
}: {
  garments: GarmentSpec[];
  frame?: { w: number; h: number };
  cropToContent?: boolean;
}) {
  const placed = garments.filter(
    (g): g is GarmentSpec & { layout: NonNullable<GarmentSpec['layout']> } => !!g.layout,
  );

  if (placed.length >= 2) {
    const sorted = [...placed].sort((a, b) => a.layout.z - b.layout.z);

    // Tuval çerçevesini koru (kırpma yok): parçalar canvas'taki tam konumlarıyla,
    // boş alanlar dahil kareye orantılı yerleştirilir.
    const useFrame = frame && !cropToContent && frame.w > 0 && frame.h > 0;
    if (useFrame) {
      const fspan = Math.max(frame.w, frame.h);
      const offXpct = ((fspan - frame.w) / 2 / fspan) * 100;
      const offYpct = ((fspan - frame.h) / 2 / fspan) * 100;
      return (
        <View style={[styles.fluidCollage, { padding: 0 }]}>
          {sorted.map((g, i) => {
            const s = CANVAS_BASE * g.layout.scale;
            const left = offXpct + (g.layout.x / fspan) * 100;
            const top = offYpct + (g.layout.y / fspan) * 100;
            const w = (s / fspan) * 100;
            return (
              <View
                key={i}
                style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${w}%`, aspectRatio: 1 }}
              >
                {g.imageUri ? (
                  <Image source={{ uri: g.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                ) : (
                  <GarmentArt category={g.category} subcategory={g.subcategory} colorId={g.colorId} size="100%" />
                )}
              </View>
            );
          })}
        </View>
      );
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const g of sorted) {
      const s = CANVAS_BASE * g.layout.scale;
      minX = Math.min(minX, g.layout.x);
      minY = Math.min(minY, g.layout.y);
      maxX = Math.max(maxX, g.layout.x + s);
      maxY = Math.max(maxY, g.layout.y + s);
    }
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const span = Math.max(bw, bh);
    const C = 0.86; // içerik alanı — kenarlarda ~%7 boşluk
    const pad = (1 - C) / 2;
    const extraX = (span - bw) / 2; // dar ekseni ortala
    const extraY = (span - bh) / 2;

    return (
      <View style={[styles.fluidCollage, { padding: 0 }]}>
        {sorted.map((g, i) => {
          const s = CANVAS_BASE * g.layout.scale;
          const left = (((g.layout.x - minX + extraX) / span) * C + pad) * 100;
          const top = (((g.layout.y - minY + extraY) / span) * C + pad) * 100;
          const w = (s / span) * C * 100;
          return (
            <View
              key={i}
              style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${w}%`, aspectRatio: 1 }}
            >
              {g.imageUri ? (
                <Image source={{ uri: g.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              ) : (
                <GarmentArt category={g.category} subcategory={g.subcategory} colorId={g.colorId} size="100%" />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  const shown = garments.slice(0, 4);
  return (
    <View style={styles.fluidCollage}>
      <View style={styles.fluidGrid}>
        {shown.map((g, i) => (
          <View key={i} style={styles.fluidCell}>
            {g.imageUri ? (
              <Image
                source={{ uri: g.imageUri }}
                style={{ width: '86%', aspectRatio: 1, borderRadius: radius.sm }}
                contentFit="contain"
              />
            ) : (
              <View style={{ width: '78%', aspectRatio: 1 }}>
                <GarmentArt category={g.category} subcategory={g.subcategory} colorId={g.colorId} size="100%" />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${Math.max(1, mins)} dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün`;
  return `${Math.floor(days / 7)} hf`;
}

export const KIND_LABEL: Record<CommunityPost['kind'], string> = {
  kombin: '🎨 Kombin',
  selfie: '🤳 Selfie',
  tryon: '🪞 Sanal deneme',
  lookbook: '📖 Lookbook',
};

export function PostCard({
  post,
  me,
  followed,
  onToggleLike,
  onToggleFollow,
  onOpenComments,
  onOpenUser,
  onOpenLookbook,
  onDelete,
}: {
  post: CommunityPost;
  /** Lookbook gönderisine dokunulduğunda o lookbook'u aç */
  onOpenLookbook?: (post: CommunityPost) => void;
  me: { name: string; username: string; archetypeId?: string; avatarUri?: string };
  followed: boolean;
  onToggleLike: () => void;
  onToggleFollow: () => void;
  onOpenComments: () => void;
  onOpenUser: () => void;
  onDelete?: () => void;
}) {
  /**
   * Gerçek fotoğrafın kendi en-boy oranı.
   * Kare kutuya `cover` ile basmak dikey görselleri (sanal deneme çıktısı 2:3)
   * üstten ve alttan kırpıyordu. Görsel yüklenince gerçek oranı öğrenip
   * kutuyu ona göre kuruyoruz — ne kırpma ne boş bant kalıyor.
   */
  const [mediaRatio, setMediaRatio] = useState<number | null>(null);
  const user = resolveUser(post.userId, me);
  const arch = getArchetype(post.archetypeId);
  const likeCount = post.likes + (post.likedByMe ? 1 : 0);

  return (
    <View style={styles.card}>
      {/* Üst satır */}
      <View style={styles.cardHead}>
        <Avatar user={user} onPress={onOpenUser} />
        <Pressable style={{ flex: 1 }} onPress={onOpenUser}>
          <Text style={[type.subtitle, { fontSize: 15 }]}>{user.name}</Text>
          <Text style={type.tiny}>
            @{user.username} · {timeAgo(post.createdAt)} · {KIND_LABEL[post.kind]}
          </Text>
        </Pressable>
        {user.isMe ? (
          onDelete ? (
            <Pressable onPress={onDelete} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.inkFaint} />
            </Pressable>
          ) : null
        ) : (
          <Pressable
            onPress={onToggleFollow}
            style={[styles.followBtn, followed && { backgroundColor: colors.background }]}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '700',
                color: followed ? colors.inkSoft : '#fff',
              }}
            >
              {followed ? 'Takiptesin' : 'Takip et'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Görsel — kapsayıcıya göre esner, asla taşmaz */}
      <View style={styles.mediaWrap}>
        {post.outfitSets?.length ? (
          /*
            Lookbook: her kombin kendi kolajı (en fazla 4). FluidSpecCollage
            kullanılıyor — SpecCollage yalnızca silüet çiziyor, persona'lar için.
            Karta dokununca lookbook sayfası açılıyor.
          */
          <Pressable onPress={() => onOpenLookbook?.(post)} disabled={!onOpenLookbook}>
            <View style={styles.setGrid}>
              {post.outfitSets.slice(0, 4).map((set, i) => (
                <View key={i} style={styles.setCell}>
                  <FluidSpecCollage
                    garments={set.garments}
                    frame={set.canvasFrame}
                    cropToContent={set.cropToContent}
                  />
                </View>
              ))}
            </View>
            {post.outfitSets.length > 4 ? (
              <Text style={styles.setMoreText}>
                +{post.outfitSets.length - 4} kombin daha — görmek için dokun
              </Text>
            ) : null}
          </Pressable>
        ) : post.imageUri ? (
          <Image
            source={{ uri: post.imageUri }}
            style={[styles.mediaImg, { aspectRatio: mediaRatio ?? 1 }]}
            contentFit="contain"
            onLoad={(e) => {
              const { width: w, height: h } = e.source ?? {};
              if (!w || !h) return;
              // Aşırı uzun/geniş görseller akışı bozmasın diye sınırla
              setMediaRatio(Math.min(1.4, Math.max(0.6, w / h)));
            }}
          />
        ) : (
          <FluidSpecCollage
            garments={post.garments}
            frame={post.canvasFrame}
            cropToContent={post.cropToContent}
          />
        )}
      </View>

      {arch ? (
        <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
          <View style={[styles.archChip, { backgroundColor: arch.colorSoft }]}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: arch.color }}>
              {arch.emoji} {arch.styleName} stil
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={[type.body, { marginTop: spacing.sm, lineHeight: 20 }]}>{post.caption}</Text>

      {/* Aksiyonlar */}
      <View style={styles.actions}>
        <Pressable onPress={onToggleLike} style={styles.actionBtn} hitSlop={6}>
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={21}
            color={post.likedByMe ? colors.coral : colors.inkSoft}
          />
          <Text style={styles.actionText}>{likeCount.toLocaleString('tr-TR')}</Text>
        </Pressable>
        <Pressable onPress={onOpenComments} style={styles.actionBtn} hitSlop={6}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.inkSoft} />
          <Text style={styles.actionText}>{post.comments.length}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collage: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  collageGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignContent: 'center',
    justifyContent: 'center',
  },
  collageCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: '#FAFDFE',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow.card,
  },
  mediaWrap: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  setGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  /** İki sütun: yüzde genişlik — sabit piksel kapsayıcıya sığmıyordu. */
  setCell: { width: '48%' },
  setMoreText: { fontSize: 12, color: colors.aquaDark, fontWeight: '600', marginTop: spacing.sm },
  mediaImg: {
    width: '100%',
    // aspectRatio satır içinde: görselin gerçek oranı yüklendiğinde uygulanır
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  fluidCollage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    overflow: 'hidden',
  },
  fluidGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignContent: 'center',
    justifyContent: 'center',
  },
  fluidCell: {
    width: '47%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: '#FAFDFE',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  followBtn: {
    backgroundColor: colors.aqua,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  archChip: {
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13.5, fontWeight: '700', color: colors.inkSoft },
});
