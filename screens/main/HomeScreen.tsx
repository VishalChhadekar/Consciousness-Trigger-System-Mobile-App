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
import { DomainBadge, parseDomain } from '../../components/DomainBadge';
import { C, DOMAIN_COLORS } from '../../constants/colors';
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
  const greeting = getGreeting();

  // Derive the domain accent color for the card's left border
  const domain = notification?.type ? parseDomain(notification.type) : '';
  const accentColor = domain ? (DOMAIN_COLORS[domain] ?? C.border) : C.border;

  return (
    <Screen contentStyle={styles.container}>
      {/* Greeting */}
      <Text style={styles.greeting}>{greeting}</Text>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Consciousness Trigger</Text>
        <View style={styles.headerLinks}>
          <TouchableOpacity onPress={() => navigation.navigate('NotificationHistory')}>
            <Text style={styles.headerLink}>History</Text>
          </TouchableOpacity>
          <Text style={styles.headerLinkDivider}>·</Text>
          <TouchableOpacity onPress={() => navigation.navigate('WeeklySummary')}>
            <Text style={styles.headerLink}>Weekly</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Trigger card — left border color reflects the domain */}
      <View style={[styles.card, { borderLeftColor: accentColor }]}>
        {hasNotification ? (
          <>
            {notification.type ? <DomainBadge type={notification.type} /> : null}
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
  container: { paddingTop: 56, gap: 0 },
  greeting: {
    color: C.textDim,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: { color: C.text, fontSize: 17, fontWeight: '600', letterSpacing: 0.4 },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLink: { color: C.textMuted, fontSize: 14 },
  headerLinkDivider: { color: C.textDim, fontSize: 14 },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 24,
  },
  card: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.border,
    padding: 24,
    gap: 14,
    justifyContent: 'center',
    maxHeight: 280,
    marginBottom: 24,
  },
  content: {
    color: C.text,
    fontSize: 22,
    lineHeight: 34,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  empty: {
    color: C.textDim,
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
  },
  actions: { gap: 12, paddingBottom: 8 },
  respondBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  respondText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
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
