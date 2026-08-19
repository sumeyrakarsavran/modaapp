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
  bare,
}: {
  garments: GarmentSpec[];
  frame?: { w: number; h: number };
  cropToContent?: boolean;
  /** Kendi zeminini/çerçevesini çizme — profil ızgarasında ortak zemin görünsün. */
  bare?: boolean;
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
        <View style={[styles.fluidCollage, { padding: 0 }, bare && styles.fluidBare]}>
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
      <View style={[styles.fluidCollage, { padding: 0 }, bare && styles.fluidBare]}>
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
    <View style={[styles.fluidCollage, bare && styles.fluidBare]}>
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
        Kart düzeni örnek (5)'ten: görselin ALTINA binen koyu perdenin üstünde
        kullanıcı satırı (avatar + ad + @kullanıcı · süre), altında ayrı bir
        panelde italik açıklama ve etkileşim satırı.
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
          </Pressable>
        ) : post.imageUri ? (
          <Image
            source={{ uri: post.imageUri }}
            style={[styles.mediaImg, { aspectRatio: mediaRatio ?? 0.8 }]}
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

        {/* Görselin altına inen koyu perde — üstündeki beyaz yazı okunsun */}
        <LinearGradient
          colors={['transparent', 'rgba(23,23,26,0.15)', 'rgba(23,23,26,0.6)']}
          locations={[0.55, 0.78, 1]}
          style={styles.mediaScrim}
          pointerEvents="none"
        />

        {/* Kullanıcı satırı — perdenin üstünde, sol altta */}
        <View style={styles.mediaFoot} pointerEvents="box-none">
          <Pressable style={styles.userRow} onPress={onOpenUser}>
            <View style={styles.avatarRing}>
              <Avatar user={user} size={34} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.userMeta} numberOfLines={1}>
                @{user.username} · {timeAgo(post.createdAt)}
              </Text>
            </View>
          </Pressable>
          {user.isMe ? (
            onDelete ? (
              <Pressable style={styles.mediaBtn} onPress={onDelete} hitSlop={6}>
                <Ionicons name="trash-outline" size={16} color={luxe.onDark} />
              </Pressable>
            ) : null
          ) : (
            <Pressable style={styles.mediaBtn} onPress={onToggleFollow} hitSlop={6}>
              <Ionicons
                name={followed ? 'checkmark' : 'person-add-outline'}
                size={16}
                color={luxe.onDark}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Alt panel: italik açıklama + etiketler + etkileşimler */}
      <View style={styles.body}>
        <Text style={styles.caption}>{post.caption}</Text>

        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{KIND_LABEL[post.kind]}</Text>
          </View>
          {arch ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{arch.styleName}</Text>
            </View>
          ) : null}
          {post.outfitSets && post.outfitSets.length > 4 ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>+{post.outfitSets.length - 4} kombin</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={onToggleLike} style={styles.actionBtn} hitSlop={6}>
            <Ionicons
              name={post.likedByMe ? 'heart' : 'heart-outline'}
              size={20}
              color={post.likedByMe ? luxe.primary : luxe.outline}
            />
            <Text style={styles.actionText}>{likeCount.toLocaleString('tr-TR')}</Text>
          </Pressable>
          <Pressable onPress={onOpenComments} style={styles.actionBtn} hitSlop={6}>
            <Ionicons name="chatbubble-outline" size={18} color={luxe.outline} />
            <Text style={styles.actionText}>{post.comments.length}</Text>
          </Pressable>
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
    backgroundColor: '#FAFAF8',
  },
  card: {
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: luxeRadius.xl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    ...luxeShadow.card,
  },
  /** Görsel katmanı — perde ve kullanıcı satırı bunun üstüne biniyor. */
  media: { width: '100%' },
  mediaScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
  mediaFoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  /** Beyaz halka: avatar koyu perdenin üstünde kaybolmasın. */
  avatarRing: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  userName: { fontFamily: font.bodyMedium, fontSize: 13.5, color: luxe.onDark },
  userMeta: { fontFamily: font.body, fontSize: 10.5, color: luxe.onDarkSoft, marginTop: 2 },
  mediaBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  setGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  /** İki sütun: yüzde genişlik — sabit piksel kapsayıcıya sığmıyordu. */
  setCell: { width: '48%' },
  body: { padding: 18 },
  caption: {
    fontFamily: font.body,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 22,
    color: luxe.inkSoft,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: {
    borderRadius: luxeRadius.pill,
    backgroundColor: 'rgba(232,227,240,0.6)',
    borderWidth: 1,
    borderColor: luxe.outlineSoft,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: font.label,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: luxe.primary,
  },
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
  /** Şeffaf: arkadaki yüzey görünsün (profil ızgarası). */
  fluidBare: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0 },
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
    backgroundColor: '#FAFAF8',
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
