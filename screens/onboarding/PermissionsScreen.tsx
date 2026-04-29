import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Screen } from '../../components/Screen';
import { C } from '../../constants/colors';
import { ensurePushTokenRegistered } from '../../hooks/useNotifications';
import { api, getTimeOfDay } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

export function PermissionsScreen({ navigation, route }: ScreenProps<'Permissions'>) {
  const { userId } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEnable() {
    setLoading(true);
    setError('');

    // Each step is independent — a failure in one must not block navigation to Home.
    // onboarding_complete is already set by LifeContextScreen.

    // 1. Push permission + send token to backend (FCM via Expo push service)
    try {
      await ensurePushTokenRegistered(userId);
    } catch (e) {
      console.warn('[Permissions] Push token step failed (non-fatal):', e);
    }

    // 2. Generate first trigger — the welcome moment
    try {
      const notification = await api.generateNotification(userId, getTimeOfDay());
      await Storage.saveLastNotification(notification.id, notification.content, notification.type);
      await Storage.recordGenerate();
    } catch (e) {
      console.warn('[Permissions] First notification generation failed (non-fatal):', e);
    }

    // Always navigate to Home regardless of what failed above.
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.top}>
        <Text style={styles.step}>4 / 4</Text>
        <Text style={styles.heading}>One last thing</Text>
        <Text style={styles.body}>
          Enable notifications so triggers reach you throughout the day — 2 to 5 times, during
          waking hours only.
        </Text>
        <Text style={styles.body}>
          No noise. No streaks. Just a quiet prompt asking if you're being intentional.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleEnable} disabled={loading}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={C.text} />
            <Text style={styles.loadingText}>Setting up…</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>Enable Notifications</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipBtn}
        onPress={async () => {
          await Storage.setOnboarded();
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        }}
        disabled={loading}
      >
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 64, gap: 32 },
  top: { gap: 16 },
  step: { color: C.textDim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  heading: { color: C.text, fontSize: 28, fontWeight: '600' },
  body: { color: C.textMuted, fontSize: 16, lineHeight: 24 },
  error: { color: C.danger, fontSize: 13 },
  btn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: C.text, fontSize: 16, fontWeight: '500' },
  loadingRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  loadingText: { color: C.text, fontSize: 15 },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: C.textDim, fontSize: 14 },
});
