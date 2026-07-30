import { router } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { BettaAvatar } from '@/components/BettaAvatar';
import { useStore } from '@/store/useStore';
import { colors, getArchetype } from '@/theme';

/** Sağ üst köşedeki profil avatarı — tıklayınca profil ekranı açılır. */
export function ProfileButton({ size = 40 }: { size?: number }) {
  const archetypeId = useStore((s) => s.profile.bettaArchetypeId);
  const avatarUri = useStore((s) => s.profile.avatarUri);
  const pro = useStore((s) => s.pro);
  const color = getArchetype(archetypeId)?.color ?? colors.aqua;

  return (
    <Pressable
      onPress={() => router.push('/profile')}
      hitSlop={6}
      style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
    >
      <BettaAvatar size={size} color={color} imageUri={avatarUri} pro={pro} />
    </Pressable>
  );
}
