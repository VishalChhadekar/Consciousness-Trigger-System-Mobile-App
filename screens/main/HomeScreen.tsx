import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DomainBadge } from '../../components/DomainBadge';
import { C } from '../../constants/colors';
import { api, ApiError, getTimeOfDay, type DailySummary } from '../../services/api';
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

function formatSummaryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [notification, setNotification] = useState<LocalNotification | null>(null);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null | 'error' | 'empty'>('empty');
  const [summaryLoading, setSummaryLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [uid, stored] = await Promise.all([
          Storage.getUserId(),
          Storage.getLastNotification(),
        ]);
        if (uid) {
          setUserId(uid);
          api.getUserStats(uid)
            .then((s) => setStreak(s.current_streak))
            .catch(() => null);
          loadDailySummary(uid);
        }
        if (stored) setNotification(stored);
      }
      load();
    }, [])
  );

  async function loadDailySummary(uid: string) {
    setSummaryLoading(true);
    try {
      const data = await api.getDailySummary(uid);
      setDailySummary(data ?? 'empty');
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setDailySummary('error');
      } else {
        setDailySummary('empty');
      }
    } finally {
      setSummaryLoading(false);
    }
  }

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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.appTitle}>Consciousness Trigger</Text>
          </View>
          <View style={styles.headerRight}>
            {streak !== null && streak > 0 ? (
              <TouchableOpacity
                style={styles.streakChip}
                onPress={() => navigation.navigate('Stats')}
              >
                <Text style={styles.streakText}>🔥 {streak}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.streakChipEmpty}
                onPress={() => navigation.navigate('Stats')}
              >
                <Text style={styles.streakTextEmpty}>Stats</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Nav pills row */}
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navPill} onPress={() => navigation.navigate('Journal')}>
            <Text style={styles.navPillText}>Journal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navPill} onPress={() => navigation.navigate('Planning')}>
            <Text style={styles.navPillText}>Planning</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navPill} onPress={() => navigation.navigate('NotificationHistory')}>
            <Text style={styles.navPillText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navPill} onPress={() => navigation.navigate('WeeklySummary')}>
            <Text style={styles.navPillText}>Weekly</Text>
          </TouchableOpacity>
        </View>

        {/* Trigger card */}
        <View style={styles.card}>
          {hasNotification ? (
            <>
              {notification.type ? <DomainBadge type={notification.type} /> : null}
              <Text style={styles.cardContent}>{notification.content}</Text>
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

        {/* Daily summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Today's Reflection</Text>
            {!summaryLoading && userId ? (
              <TouchableOpacity onPress={() => loadDailySummary(userId)} hitSlop={8}>
                <Text style={styles.refreshText}>↻</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {summaryLoading ? (
            <Text style={styles.summaryStateText}>Generating your daily reflection…</Text>
          ) : dailySummary === 'error' ? (
            <Text style={styles.summaryStateText}>Summary temporarily unavailable.</Text>
          ) : dailySummary === 'empty' || dailySummary === null ? (
            <Text style={styles.summaryStateText}>
              Check in with a notification first — your daily reflection will appear here.
            </Text>
          ) : (
            <>
              <Text style={styles.summaryText}>{(dailySummary as DailySummary).summary}</Text>
              <Text style={styles.summaryTimestamp}>
                Generated at {formatSummaryTime((dailySummary as DailySummary).created_at)}
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: { color: C.textDim, fontSize: 13, fontWeight: '500', letterSpacing: 0.3, marginBottom: 4 },
  appTitle: { color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: 0.2 },

  headerRight: { marginTop: 4 },
  streakChip: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFCC80',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  streakText: { fontSize: 14, fontWeight: '700' },
  streakChipEmpty: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  streakTextEmpty: { color: C.textMuted, fontSize: 13, fontWeight: '500' },

  navRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
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
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    gap: 16,
    justifyContent: 'center',
    minHeight: 160,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  cardContent: { color: C.text, fontSize: 22, lineHeight: 34, fontWeight: '500', letterSpacing: 0.1 },
  emptyInner: { gap: 6, alignItems: 'center' },
  emptyTitle: { color: C.textMuted, fontSize: 16, fontWeight: '600' },
  emptySubtitle: { color: C.textDim, fontSize: 14 },

  actions: { gap: 12, marginBottom: 8 },
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
  rateLimitMsg: { color: C.textDim, fontSize: 13, textAlign: 'center', paddingBottom: 8, marginBottom: 4 },

  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 22,
    marginTop: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    color: C.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  refreshText: { color: C.primary, fontSize: 16, fontWeight: '600' },
  summaryStateText: { color: C.textDim, fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  summaryText: { color: C.text, fontSize: 15, lineHeight: 26 },
  summaryTimestamp: { color: C.textDim, fontSize: 11 },
});
