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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [notification, setNotification] = useState<LocalNotification | null>(null);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

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
      await Promise.all([
        Storage.saveLastNotification(notif.id, notif.content, notif.type),
        Storage.recordGenerate(),
        Storage.addNotificationToHistory(notif.id, notif.content, notif.type),
      ]);
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
    } finally {
      setLoading(false);
    }
  }

  const hasNotification = notification !== null;

  return (
    <Screen contentStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.appTitle}>Consciousness Trigger</Text>
        </View>
        <View style={styles.headerLinks}>
          <TouchableOpacity
            style={styles.navPill}
            onPress={() => navigation.navigate('NotificationHistory')}
          >
            <Text style={styles.navPillText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navPill}
            onPress={() => navigation.navigate('WeeklySummary')}
          >
            <Text style={styles.navPillText}>Weekly</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Trigger card */}
      <View style={styles.card}>
        {hasNotification ? (
          <>
            {notification.type ? <DomainBadge type={notification.type} /> : null}
            <Text style={styles.content}>{notification.content}</Text>
          </>
        ) : (
          <View style={styles.emptyInner}>
            <Text style={styles.emptyTitle}>No trigger yet.</Text>
            <Text style={styles.emptySubtitle}>Tap below to generate one.</Text>
          </View>
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
            <ActivityIndicator color={C.primary} />
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
  container: { paddingTop: 56, gap: 0 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  greeting: {
    color: C.textDim,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  appTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerLinks: { flexDirection: 'row', gap: 8, marginTop: 4 },
  navPill: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  navPillText: { color: C.textMuted, fontSize: 13, fontWeight: '500' },

  card: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    gap: 16,
    justifyContent: 'center',
    maxHeight: 300,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  content: {
    color: C.text,
    fontSize: 22,
    lineHeight: 34,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  emptyInner: { gap: 6, alignItems: 'center' },
  emptyTitle: { color: C.textMuted, fontSize: 16, fontWeight: '600' },
  emptySubtitle: { color: C.textDim, fontSize: 14 },

  actions: { gap: 12, paddingBottom: 8 },
  respondBtn: {
    backgroundColor: C.primary,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  respondText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  generateBtn: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  generateText: { color: C.textMuted, fontSize: 15, fontWeight: '500' },
  btnDisabled: { opacity: 0.4 },
  rateLimitMsg: {
    color: C.textDim,
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: 8,
  },
});
