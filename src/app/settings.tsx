import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Label } from '@/components/UI';
import { isUsernameTaken } from '@/data/community';
import { isCloudEnabled } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';

export default function Settings() {
  const { api, setApi, profile, setProfile, account, pro, resetAll } = useStore();
  const [anthropicKey, setAnthropicKey] = useState(api.anthropicKey ?? '');
  const [fashnKey, setFashnKey] = useState(api.fashnKey ?? '');
  const [removeBgKey, setRemoveBgKey] = useState(api.removeBgKey ?? '');
  const [supabaseUrl, setSupabaseUrl] = useState(api.supabaseUrl ?? '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(api.supabaseAnonKey ?? '');
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saved, setSaved] = useState(false);

  const cloud = isCloudEnabled(api);

  const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
  const usernameValid = /^[a-z0-9_]{3,20}$/.test(cleanUsername);
  const usernameTaken = cleanUsername !== profile.username && isUsernameTaken(cleanUsername);
  const usernameError = !cleanUsername
    ? null
    : !usernameValid
      ? '3-20 karakter; sadece küçük harf, rakam ve alt çizgi.'
      : usernameTaken
        ? 'Bu kullanıcı adı alınmış — başka bir tane dene.'
        : null;

  const save = () => {
    if (cleanUsername && usernameError) return;
    setApi({
      anthropicKey: anthropicKey.trim() || undefined,
      fashnKey: fashnKey.trim() || undefined,
      removeBgKey: removeBgKey.trim() || undefined,
      supabaseUrl: supabaseUrl.trim() || undefined,
      supabaseAnonKey: supabaseAnonKey.trim() || undefined,
    });
    const patch: Record<string, unknown> = { bio: bio.trim() || undefined };
    if (name.trim()) patch.name = name.trim();
    if (cleanUsername && !usernameError) patch.username = cleanUsername;
    setProfile(patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const confirmReset = () => {
    const doReset = () => {
      resetAll();
      router.replace('/onboarding');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Tüm veriler silinsin mi? Bu işlem geri alınamaz.')) doReset();
    } else {
      Alert.alert('Her şeyi sıfırla', 'Tüm gardırop, kombin ve ayarlar silinecek. Emin misin?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sıfırla', style: 'destructive', onPress: doReset },
      ]);
    }
  };

  const Row = ({
    icon,
    label,
    hint,
    onPress,
    color = colors.ink,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint?: string;
    onPress: () => void;
    color?: string;
  }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontWeight: '600', color }]}>{label}</Text>
        {hint ? <Text style={type.tiny}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.inkSoft} />
        </Pressable>
        <Text style={type.subtitle}>Ayarlar</Text>
        <View style={{ width: 36 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {/* Profil bilgileri */}
          <Label>Adın</Label>
          <TextInput value={name} onChangeText={setName} style={styles.input} />

          <Label>Kullanıcı adı</Label>
          <View style={styles.usernameRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="kullaniciadi"
              placeholderTextColor={colors.inkFaint}
              style={[styles.input, { flex: 1 }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {usernameError ? (
            <Text style={[type.tiny, { color: colors.danger, marginTop: 4 }]}>{usernameError}</Text>
          ) : (
            <Text style={[type.tiny, { marginTop: 4 }]}>
              Arkadaşların seni toplulukta bu adla bulur. Herkesin kullanıcı adı benzersizdir.
            </Text>
          )}

          <Label>Bio</Label>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Kendini birkaç cümleyle anlat… 🐟"
            placeholderTextColor={colors.inkFaint}
            style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
            multiline
            maxLength={160}
          />

          {/* Gizlilik */}
          <Card style={{ marginTop: spacing.xl }}>
            <Text style={type.subtitle}>🌐 Gizlilik</Text>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '600' }]}>Herkese açık profil</Text>
                <Text style={type.tiny}>
                  Açıkken diğer kullanıcılar profilinden parçalarını, kombinlerini, selfie ve
                  lookbook'larını görebilir. Kapalıyken yalnızca toplulukta bilerek paylaştıkların
                  görünür.
                </Text>
              </View>
              <Switch
                value={!!profile.isPublic}
                onValueChange={(v) => setProfile({ isPublic: v })}
                trackColor={{ true: colors.aqua, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          </Card>

          {/* Araçlar */}
          <Text style={styles.sectionHead}>Araçlar</Text>
          <Card style={{ padding: spacing.sm }}>
            <Row icon="sparkles-outline" label="AI Stilist" hint={api.anthropicKey ? 'Claude bağlı' : 'Yerel öneri modunda'} onPress={() => router.push('/stylist')} />
            <Row
              icon="diamond-outline"
              label="BETTA Pro"
              hint={pro ? 'Aktif 🏆 — sanal deneme açık' : 'Sanal deneme ve fazlası'}
              color={pro ? '#B8860B' : colors.ink}
              onPress={() => router.push('/pro')}
            />
            <Row
              icon="shirt-outline"
              label="Sanal Deneme (FASHN)"
              hint={pro ? (api.fashnKey ? 'Bağlı' : 'API anahtarı gerekli') : 'Pro üyelere özel 🔒'}
              onPress={() => router.push('/tryon')}
            />
            <Row
              icon="cloud-outline"
              label="Hesap & Bulut"
              hint={
                cloud ? 'Supabase bağlı' : account ? `${account.email} · cihaz hesabı` : 'Hesap yok'
              }
              onPress={() => router.push('/auth')}
            />
          </Card>

          {/* API anahtarları */}
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={type.subtitle}>🔑 API anahtarları</Text>
            <Text style={[type.tiny, { marginTop: 4 }]}>
              Hepsi opsiyonel — anahtar girmezsen uygulama yerel modda çalışmaya devam eder.
              Anahtarlar yalnızca bu cihazda saklanır.
            </Text>

            <Label>Claude API (AI Stilist)</Label>
            <TextInput
              value={anthropicKey}
              onChangeText={setAnthropicKey}
              placeholder="sk-ant-…"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
            />

            <Label>FASHN AI (Sanal Deneme)</Label>
            <TextInput
              value={fashnKey}
              onChangeText={setFashnKey}
              placeholder="fa-…"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
            />

            <Label>remove.bg (opsiyonel yedek)</Label>
            <Text style={[type.tiny, { marginBottom: 6 }]}>
              Arka plan silme zaten cihazında ücretsiz çalışır (iOS 17+ Vision / Android MLKit /
              tarayıcıda WASM). Bu anahtar yalnızca cihaz desteklemiyorsa yedek olarak kullanılır.
            </Text>
            <TextInput
              value={removeBgKey}
              onChangeText={setRemoveBgKey}
              placeholder="opsiyonel"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
            />
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={type.subtitle}>☁️ Supabase (bulut & hesap)</Text>
            <Text style={[type.tiny, { marginTop: 4 }]}>
              supabase.com'da ücretsiz proje aç → Settings → API'den URL ve anon key'i kopyala.
              Sonra projendeki SQL Editor'da supabase/schema.sql dosyasını çalıştır.
            </Text>
            <Label>Project URL</Label>
            <TextInput
              value={supabaseUrl}
              onChangeText={setSupabaseUrl}
              placeholder="https://xxxx.supabase.co"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              autoCapitalize="none"
            />
            <Label>Anon key</Label>
            <TextInput
              value={supabaseAnonKey}
              onChangeText={setSupabaseAnonKey}
              placeholder="eyJ…"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              autoCapitalize="none"
              secureTextEntry
            />
          </Card>

          <Button title={saved ? '✔ Kaydedildi' : 'Kaydet'} onPress={save} style={{ marginTop: spacing.xl }} />

          {/* Tehlikeli sular */}
          <Text style={styles.sectionHead}>Tehlikeli sular 🦈</Text>
          <Card style={{ padding: spacing.sm }}>
            <Row icon="trash-outline" label="Her şeyi sıfırla" color={colors.danger} onPress={confirmReset} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  at: { fontSize: 17, fontWeight: '800', color: colors.inkSoft },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  sectionHead: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
});
