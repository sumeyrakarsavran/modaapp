import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BettaFish } from '@/components/BettaFish';
import { Button, Card, Label } from '@/components/UI';
import { getSupabase, isCloudEnabled, pullFromCloud, pushToCloud } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { colors, radius, spacing, type } from '@/theme';
import type { Outfit, PlanEntry, Profile, WardrobeItem } from '@/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hashPassword(email: string, password: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${email.trim().toLowerCase()}:${password}`,
  );
}

export default function Auth() {
  const store = useStore();
  const { api, account, signedIn, setAccount, setSignedIn } = store;
  const enabled = isCloudEnabled(api);
  const sb = enabled ? getSupabase(api) : null;

  // Yerel hesap gate'i: hesap var + oturum kapalı → kapatma butonu gizlenir
  const gated = !enabled && !!account && !signedIn;

  const [email, setEmail] = useState(account?.email ?? '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [hint, setHint] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'changepw'>(
    account ? 'signin' : 'signup',
  );
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setSessionEmail(data.user?.email ?? null));
  }, [sb]);

  const goHome = () => router.replace('/(tabs)/today');

  /* ————— Yerel hesap akışları ————— */

  const localSignUp = async () => {
    setMsg(null);
    if (!EMAIL_RE.test(email.trim())) return setMsg('Geçerli bir e-posta gir.');
    if (password.length < 6) return setMsg('Şifre en az 6 karakter olmalı.');
    if (password !== password2) return setMsg('Şifreler eşleşmiyor.');
    setBusy(true);
    const passwordHash = await hashPassword(email, password);
    setAccount({
      email: email.trim().toLowerCase(),
      passwordHash,
      hint: hint.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    setSignedIn(true);
    setBusy(false);
    goHome();
  };

  const localSignIn = async () => {
    setMsg(null);
    if (!account) return;
    setBusy(true);
    const h = await hashPassword(account.email, password);
    setBusy(false);
    if (h !== account.passwordHash) {
      setMsg('Şifre yanlış. Tekrar dene ya da "Şifremi unuttum"a bak.');
      return;
    }
    setSignedIn(true);
    goHome();
  };

  const localSignOut = () => {
    setSignedIn(false);
    setPassword('');
    setMode('signin');
  };

  const localResetPassword = async () => {
    setMsg(null);
    if (!account) return;
    if (newPassword.length < 6) return setMsg('Yeni şifre en az 6 karakter olmalı.');
    if (newPassword !== password2) return setMsg('Şifreler eşleşmiyor.');
    setBusy(true);
    const passwordHash = await hashPassword(account.email, newPassword);
    setAccount({ ...account, passwordHash });
    setSignedIn(true);
    setBusy(false);
    setNewPassword('');
    setPassword2('');
    goHome();
  };

  const localChangePassword = async () => {
    setMsg(null);
    if (!account) return;
    setBusy(true);
    const cur = await hashPassword(account.email, currentPassword);
    if (cur !== account.passwordHash) {
      setBusy(false);
      return setMsg('Mevcut şifre yanlış.');
    }
    if (newPassword.length < 6) {
      setBusy(false);
      return setMsg('Yeni şifre en az 6 karakter olmalı.');
    }
    const passwordHash = await hashPassword(account.email, newPassword);
    setAccount({ ...account, passwordHash, hint: hint.trim() || account.hint });
    setBusy(false);
    setCurrentPassword('');
    setNewPassword('');
    setMode('signin');
    setMsg('✔ Şifre değiştirildi.');
  };

  const deleteLocalAccount = () => {
    setAccount(null);
    setSignedIn(false);
    setMsg('Hesap kaldırıldı — gardırobun cihazında durmaya devam ediyor.');
    setMode('signup');
  };

  /* ————— Supabase akışları ————— */

  const sbSubmit = async () => {
    if (!sb) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'signup') {
        const { error } = await sb.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setMsg('Kayıt oluşturuldu! E-postana doğrulama bağlantısı gelmiş olabilir.');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      const { data } = await sb.auth.getUser();
      setSessionEmail(data.user?.email ?? null);
    } catch (e: any) {
      setMsg(e?.message ?? 'Bir sorun oluştu.');
    } finally {
      setBusy(false);
    }
  };

  const sbForgot = async () => {
    if (!sb) return;
    if (!EMAIL_RE.test(email.trim())) return setMsg('Önce e-posta adresini yaz.');
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setMsg('📬 Şifre sıfırlama bağlantısı e-postana gönderildi.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Sıfırlama e-postası gönderilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const sbSignOut = async () => {
    if (!sb) return;
    await sb.auth.signOut();
    setSessionEmail(null);
  };

  const sbPush = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await pushToCloud(api, {
        items: store.items,
        outfits: store.outfits,
        plans: store.plans,
        profile: store.profile,
      });
      setMsg('✔ Gardırobun buluta yüklendi.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Yükleme hatası.');
    } finally {
      setBusy(false);
    }
  };

  const sbPull = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const data = await pullFromCloud(api);
      if (!data) {
        setMsg('Bulutta kayıtlı gardırop bulunamadı — önce yükleme yap.');
      } else {
        useStore.setState({
          items: (data.items as WardrobeItem[]) ?? [],
          outfits: (data.outfits as Outfit[]) ?? [],
          plans: (data.plans as PlanEntry[]) ?? [],
          profile: { ...store.profile, ...(data.profile as Profile) },
        });
        setMsg('✔ Buluttaki gardırop indirildi.');
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'İndirme hatası.');
    } finally {
      setBusy(false);
    }
  };

  const input = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    opts: { secure?: boolean; email?: boolean } = {},
  ) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      style={styles.input}
      autoCapitalize="none"
      secureTextEntry={opts.secure}
      keyboardType={opts.email ? 'email-address' : 'default'}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        {gated ? (
          <View style={{ width: 36 }} />
        ) : (
          <Pressable onPress={() => router.back()} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.inkSoft} />
          </Pressable>
        )}
        <Text style={type.subtitle}>{enabled ? '☁️ Bulut & Hesap' : '🔐 Hesap'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {gated ? (
            <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              <BettaFish size={90} color={colors.aqua} />
              <Text style={[type.title, { marginTop: spacing.sm }]}>Tekrar hoş geldin 🐟</Text>
            </View>
          ) : null}

          {/* ————— SUPABASE MODU ————— */}
          {enabled ? (
            sessionEmail ? (
              <Card>
                <Text style={type.subtitle}>👋 {sessionEmail}</Text>
                <Text style={[type.tiny, { marginTop: 4 }]}>
                  Giriş yapıldı — gardırobunu senkronlayabilirsin.
                </Text>
                <View style={styles.btnRow}>
                  <Button small title="⬆️ Buluta yükle" onPress={sbPush} loading={busy} />
                  <Button small variant="secondary" title="⬇️ Buluttan indir" onPress={sbPull} loading={busy} />
                  <Button small variant="ghost" title="Çıkış yap" onPress={sbSignOut} />
                </View>
              </Card>
            ) : (
              <Card>
                <Text style={type.subtitle}>
                  {mode === 'signup' ? 'Hesap oluştur' : 'Giriş yap'}
                </Text>
                <Label>E-posta</Label>
                {input(email, setEmail, 'sen@ornek.com', { email: true })}
                <Label>Şifre</Label>
                {input(password, setPassword, '••••••••', { secure: true })}
                <Button
                  title={mode === 'signup' ? 'Kayıt ol' : 'Giriş yap'}
                  onPress={sbSubmit}
                  loading={busy}
                  style={{ marginTop: spacing.lg }}
                />
                <View style={styles.btnRow}>
                  <Button
                    small
                    variant="ghost"
                    title={mode === 'signup' ? 'Zaten üye misin? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
                    onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                  />
                  {mode !== 'signup' ? (
                    <Button small variant="ghost" title="Şifremi unuttum" onPress={sbForgot} />
                  ) : null}
                </View>
              </Card>
            )
          ) : /* ————— YEREL MOD ————— */ signedIn && account ? (
            <>
              <Card>
                <Text style={type.subtitle}>👋 {account.email}</Text>
                <Text style={[type.tiny, { marginTop: 4 }]}>
                  Cihaz hesabı — verilerin bu cihazda. Bulut senkronu için Ayarlar'dan Supabase
                  bağlayabilirsin.
                </Text>
                <View style={styles.btnRow}>
                  <Button small variant="secondary" title="🔑 Şifre değiştir" onPress={() => { setMsg(null); setMode('changepw'); }} />
                  <Button small variant="ghost" title="Çıkış yap" onPress={localSignOut} />
                </View>
              </Card>
              {mode === 'changepw' ? (
                <Card style={{ marginTop: spacing.md }}>
                  <Text style={type.subtitle}>Şifre değiştir</Text>
                  <Label>Mevcut şifre</Label>
                  {input(currentPassword, setCurrentPassword, '••••••••', { secure: true })}
                  <Label>Yeni şifre</Label>
                  {input(newPassword, setNewPassword, 'en az 6 karakter', { secure: true })}
                  <Label>Şifre ipucu (opsiyonel)</Label>
                  {input(hint, setHint, account.hint ?? 'örn. ilk akvaryumumun adı')}
                  <View style={styles.btnRow}>
                    <Button small title="Kaydet" onPress={localChangePassword} loading={busy} />
                    <Button small variant="ghost" title="Vazgeç" onPress={() => setMode('signin')} />
                  </View>
                </Card>
              ) : null}
              <Card style={{ marginTop: spacing.md }}>
                <Text style={type.subtitle}>Hesabı kaldır</Text>
                <Text style={[type.tiny, { marginTop: 4 }]}>
                  Giriş kilidini kaldırır; gardırobun ve tüm verilerin cihazında kalır.
                </Text>
                <Button
                  small
                  variant="danger"
                  title="Hesabı kaldır"
                  onPress={deleteLocalAccount}
                  style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                />
              </Card>
            </>
          ) : account ? (
            /* Giriş / şifremi unuttum */
            mode === 'forgot' ? (
              <Card>
                <Text style={type.subtitle}>Şifremi unuttum</Text>
                {account.hint ? (
                  <View style={styles.hintBox}>
                    <Text style={type.tiny}>Şifre ipucun:</Text>
                    <Text style={[type.body, { fontWeight: '700' }]}>{account.hint}</Text>
                  </View>
                ) : (
                  <Text style={[type.tiny, { marginTop: spacing.sm }]}>
                    Kayıt olurken ipucu bırakmamışsın.
                  </Text>
                )}
                <Text style={[type.caption, { marginTop: spacing.md }]}>
                  Bu bir cihaz hesabı olduğu için şifreni burada yenileyebilirsin:
                </Text>
                <Label>Yeni şifre</Label>
                {input(newPassword, setNewPassword, 'en az 6 karakter', { secure: true })}
                <Label>Yeni şifre (tekrar)</Label>
                {input(password2, setPassword2, '••••••••', { secure: true })}
                <Button title="Şifreyi sıfırla ve gir" onPress={localResetPassword} loading={busy} style={{ marginTop: spacing.lg }} />
                <Button small variant="ghost" title="← Girişe dön" onPress={() => { setMsg(null); setMode('signin'); }} style={{ marginTop: spacing.sm }} />
              </Card>
            ) : (
              <Card>
                <Text style={type.subtitle}>Giriş yap</Text>
                <Text style={[type.tiny, { marginTop: 4 }]}>{account.email}</Text>
                <Label>Şifre</Label>
                {input(password, setPassword, '••••••••', { secure: true })}
                <Button title="Giriş yap" onPress={localSignIn} loading={busy} style={{ marginTop: spacing.lg }} />
                <Button
                  small
                  variant="ghost"
                  title="Şifremi unuttum"
                  onPress={() => { setMsg(null); setMode('forgot'); }}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>
            )
          ) : mode === 'signup' ? (
            /* Kayıt ol */
            <Card>
              <Text style={type.subtitle}>Hesap oluştur</Text>
              <Text style={[type.tiny, { marginTop: 4 }]}>
                Uygulamana giriş kilidi ekler. Veriler cihazında kalır; bulut için Ayarlar'dan
                Supabase bağla.
              </Text>
              <Label>E-posta</Label>
              {input(email, setEmail, 'sen@ornek.com', { email: true })}
              <Label>Şifre</Label>
              {input(password, setPassword, 'en az 6 karakter', { secure: true })}
              <Label>Şifre (tekrar)</Label>
              {input(password2, setPassword2, '••••••••', { secure: true })}
              <Label>Şifre ipucu (opsiyonel)</Label>
              {input(hint, setHint, 'örn. ilk akvaryumumun adı')}
              <Button title="Kayıt ol" onPress={localSignUp} loading={busy} style={{ marginTop: spacing.lg }} />
            </Card>
          ) : null}

          {msg ? (
            <Text style={[type.caption, { marginTop: spacing.md, textAlign: 'center' }]}>{msg}</Text>
          ) : null}
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
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  hintBox: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
});
