import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { DomainBadge } from '../../components/DomainBadge';
import { C } from '../../constants/colors';
import { api, ApiError, getTimeOfDay } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

const FALLBACK_CONTENT = 'Right now… chosen or autopilot?';

type LocalNotification = { id: string; content: string; type: string };

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [notification, setNotification] = useState<LocalNotification | null>(null);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

  // Reload last notification every time the screen comes into focus
  // (so it refreshes after returning from Response screen)
  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [uid, stored] = await Promise.all([
          Storage.getUserId(),
          Storage.getLastNotification(),
        ]);
        if (uid) setUserId(uid);
        if (stored) setNotification(stored);
      }
      load();
    }, [])
  );

  async function handleGetAnother() {
    if (!userId) return;
    const allowed = await Storage.canGenerateManual();
    if (!allowed) {
      setRateLimited(true);
      return;
    }
    setRateLimited(false);
    setLoading(true);
    try {
      const notif = await api.generateNotification(userId, getTimeOfDay());
      await Storage.saveLastNotification(notif.id, notif.content, notif.type);
      await Storage.recordGenerate();
      setNotification({ id: notif.id, content: notif.content, type: notif.type });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 422) {
          navigation.reset({ index: 0, routes: [{ name: 'Name' }] });
          return;
        }
        if (e.status === 503) {
          setNotification({ id: '', content: FALLBACK_CONTENT, type: '' });
          return;
        }
      }
      // silent — don't surface generic errors on home
    } finally {
      setLoading(false);
    }
  }

  const hasNotification = notification !== null;
  const ts = notification
    ? '' // could format notification.created_at if stored; omitted for simplicity
    : '';

  return (
    <Screen contentStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Consciousness Trigger</Text>
        <TouchableOpacity onPress={() => navigation.navigate('WeeklySummary')}>
          <Text style={styles.summaryLink}>Weekly</Text>
        </TouchableOpacity>
      </View>

      {/* Notification card */}
      <View style={styles.card}>
        {hasNotification ? (
          <>
            {notification.type ? (
              <DomainBadge type={notification.type} />
            ) : null}
            <Text style={styles.content}>{notification.content}</Text>
          </>
        ) : (
          <Text style={styles.empty}>No trigger yet.{'\n'}Tap below to generate one.</Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {hasNotification && notification.id ? (
          <TouchableOpacity
            style={styles.respondBtn}
            onPress={() =>
              navigation.navigate('Response', {
                notificationId: notification.id,
                content: notification.content,
                notificationType: notification.type,
              })
            }
          >
            <Text style={styles.respondText}>Respond</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.generateBtn, loading && styles.btnDisabled]}
          onPress={handleGetAnother}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={C.textMuted} />
          ) : (
            <Text style={styles.generateText}>
              {hasNotification ? 'Get Another' : 'Generate Trigger'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {rateLimited && (
        <Text style={styles.rateLimitMsg}>
          That's enough for now. Come back in a couple of hours.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 56, gap: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appTitle: { color: C.text, fontSize: 17, fontWeight: '600', letterSpacing: 0.5 },
  summaryLink: { color: C.textMuted, fontSize: 14 },
  card: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 24,
    gap: 14,
    justifyContent: 'center',
    maxHeight: 260,
  },
  content: {
    color: C.text,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  empty: {
    color: C.textDim,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: { gap: 12, paddingBottom: 8 },
  respondBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  respondText: { color: C.text, fontSize: 16, fontWeight: '500' },
  generateBtn: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateText: { color: C.textMuted, fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  rateLimitMsg: {
    color: C.textDim,
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: 8,
  },
});
