import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BettaAvatar } from '@/components/BettaAvatar';
import { GarmentArt } from '@/components/GarmentArt';
import { CANVAS_BASE } from '@/components/OutfitCollage';
import { PERSONAS } from '@/data/community';
import { getArchetype, radius, shadow, spacing } from '@/theme';
import { font, glass, iridescent, luxe, luxeRadius, luxeShadow, luxeType } from '@/theme/luxe';
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
      color: getArchetype(me.archetypeId)?.color ?? luxe.primary,
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
      color: luxe.primary,
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
  kombin: 'Kombin',
  selfie: 'Selfie',
  tryon: 'Sanal deneme',
  lookbook: 'Lookbook',
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
      {/*
        Editoryal kart: görsel tam genişlikte, kullanıcı rozeti görselin ÜSTÜNDE
        yüzen cam bir hap, etkileşimler ve açıklama alttaki AÇIK perdenin
        içinde. Ayrı başlık satırı yok — kart bir dergi sayfası gibi duruyor.
      */}
      <View style={styles.media}>
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
                  {/*
                    `garments ?? []`: eski kayıtlarda outfitSets düz
                    GarmentSpec[][] idi. Store migrate'i sarıyor ama
                    migrate'ten önce yazılmış kayıt akışı çökertmesin.
                  */}
                  <FluidSpecCollage
                    garments={set?.garments ?? (Array.isArray(set) ? set : [])}
                    frame={set?.canvasFrame}
                    cropToContent={set?.cropToContent}
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
            contentFit="cover"
            onLoad={(e) => {
              const { width: w, height: h } = e.source ?? {};
              if (!w || !h) return;
              // Aşırı uzun/geniş görseller akışı bozmasın diye sınırla
              setMediaRatio(Math.min(1, Math.max(0.62, w / h)));
            }}
          />
        ) : (
          <FluidSpecCollage
            garments={post.garments}
            frame={post.canvasFrame}
            cropToContent={post.cropToContent}
          />
        )}

        {/* Yüzen cam kullanıcı rozeti */}
        <Pressable style={styles.userChip} onPress={onOpenUser}>
          <Avatar user={user} size={22} />
          <Text style={styles.userChipText} numberOfLines={1}>
            @{user.username}
          </Text>
        </Pressable>

        {/* Sağ üst: kendi gönderinde sil, başkasınınkinde takip */}
        {user.isMe ? (
          onDelete ? (
            <Pressable style={styles.cornerBtn} onPress={onDelete} hitSlop={6}>
              <Ionicons name="trash-outline" size={16} color={luxe.primary} />
            </Pressable>
          ) : null
        ) : (
          <Pressable style={styles.followChip} onPress={onToggleFollow}>
            <Text style={styles.followChipText}>{followed ? 'Takiptesin' : 'Takip et'}</Text>
          </Pressable>
        )}

        {/*
          Perde AÇIK renk (örnekteki gibi): akıştaki görseller hem fotoğraf hem
          beyaz zeminli kolaj olabiliyor, koyu perde kolajları çamurlaştırıyor.
        */}
        <LinearGradient
          colors={['transparent', 'rgba(247,245,242,0.72)', 'rgba(247,245,242,0.97)']}
          locations={[0.45, 0.72, 0.92]}
          style={styles.scrim}
          pointerEvents="none"
        />
        <View style={styles.scrimBody} pointerEvents="box-none">
          <View style={styles.actionRow}>
            <Pressable onPress={onToggleLike} style={styles.actionBtn} hitSlop={6}>
              <Ionicons
                name={post.likedByMe ? 'heart' : 'heart-outline'}
                size={19}
                color={post.likedByMe ? luxe.primary : luxe.inkSoft}
              />
              <Text style={styles.actionText}>{likeCount.toLocaleString('tr-TR')}</Text>
            </Pressable>
            <Pressable onPress={onOpenComments} style={styles.actionBtn} hitSlop={6}>
              <Ionicons name="chatbubble-outline" size={17} color={luxe.inkSoft} />
              <Text style={styles.actionText}>{post.comments.length}</Text>
            </Pressable>
          </View>
          <Text style={styles.caption}>{post.caption}</Text>
          <Text style={styles.meta}>
            {KIND_LABEL[post.kind]} · {timeAgo(post.createdAt)}
            {arch ? ` · ${arch.styleName}` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collage: {
    backgroundColor: luxe.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
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
    backgroundColor: luxe.surface,
    borderRadius: luxeRadius.xl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    ...luxeShadow.card,
  },
  /** Görsel katmanı — rozetler ve perde bunun üstüne biniyor. */
  media: { width: '100%' },
  userChip: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 5,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: luxeRadius.pill,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.border,
    maxWidth: '70%',
  },
  userChipText: { fontFamily: font.bodyMedium, fontSize: 12, color: luxe.primary, flexShrink: 1 },
  cornerBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.border,
  },
  followChip: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: luxeRadius.pill,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.border,
  },
  followChipText: { fontFamily: font.bodyMedium, fontSize: 11.5, color: luxe.primary },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  scrimBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18 },
  caption: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: luxe.ink, marginTop: 10 },
  meta: {
    fontFamily: font.label,
    fontSize: 9.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: luxe.outline,
    marginTop: 8,
  },
  setGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  /** İki sütun: yüzde genişlik — sabit piksel kapsayıcıya sığmıyordu. */
  setCell: { width: '48%' },
  setMoreText: { fontSize: 12, color: luxe.primaryDeep, fontWeight: '600', marginTop: spacing.sm },
  mediaImg: {
    width: '100%',
    // aspectRatio satır içinde: görselin gerçek oranı yüklendiğinde uygulanır
    borderRadius: radius.md,
    backgroundColor: luxe.surface,
  },
  fluidCollage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: luxe.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
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
    backgroundColor: luxe.primary,
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
    borderTopColor: luxe.outlineSoft,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionText: { fontSize: 13.5, fontWeight: '700', color: luxe.inkSoft },
});
