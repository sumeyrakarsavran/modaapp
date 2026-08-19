import { router } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { BettaAvatar } from '@/components/BettaAvatar';
import { useStore } from '@/store/useStore';
import { luxe } from '@/theme/luxe';

/** Sağ üst köşedeki profil avatarı — tıklayınca profil ekranı açılır. */
export function ProfileButton({ size = 40 }: { size?: number }) {
  const avatarUri = useStore((s) => s.profile.avatarUri);
  const pro = useStore((s) => s.pro);
  /*
    Halka PALETTEN. Önce arketipin kendi doygun rengiydi (mercan, turkuaz…) ve
    fildişi sayfalarda bağırıyordu; arketip kimliği zaten profil ekranında
    yazıyla duruyor.
  */

  return (
    <Pressable
      onPress={() => router.push('/profile')}
      hitSlop={6}
      style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
    >
      <BettaAvatar size={size} color={luxe.primarySoft} imageUri={avatarUri} pro={pro} />
    </Pressable>
  );
}
