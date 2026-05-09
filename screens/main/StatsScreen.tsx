import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { C } from '../../constants/colors';
import { api, type UserStats } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

type BadgeDef = { id: string; icon: string; label: string; desc: string };

const ALL_BADGES: BadgeDef[] = [
  { id: 'first_reflection', icon: '✦', label: 'First Reflection', desc: 'Responded to your first trigger' },
  { id: 'ten_reflections', icon: '◈', label: '10 Reflections', desc: 'Responded 10 times total' },
  { id: 'fifty_reflections', icon: '◉', label: '50 Reflections', desc: 'Responded 50 times total' },
  { id: 'streak_7', icon: '🔥', label: '7-Day Streak', desc: '7 consecutive days of responses' },
  { id: 'streak_30', icon: '⚡', label: '30-Day Streak', desc: '30 consecutive days of responses' },
];

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function StatsScreen({ navigation }: ScreenProps<'Stats'>) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Storage.getUserId().then((uid) => {
        if (!uid) return;
        setLoading(true);
        api.getUserStats(uid)
          .then(setStats)
          .catch(() => null)
          .finally(() => setLoading(false));
      });
    }, [])
  );

  const earnedIds = new Set((stats?.badges ?? []).map((b) => b.id));
  const responseRate = stats ? Math.round(stats.response_rate * 100) : 0;

  return (
    <Screen contentStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Stats</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && !stats ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Streak hero */}
          <View style={styles.streakHero}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={styles.streakCount}>{stats?.current_streak ?? 0}</Text>
            <Text style={styles.streakSubLabel}>day streak</Text>
          </View>

          {/* Stat grid */}
          <View style={styles.statGrid}>
            <StatCard value={stats?.longest_streak ?? 0} label="Longest streak" />
            <StatCard value={`${responseRate}%`} label="Response rate" />
            <StatCard value={stats?.total_responses ?? 0} label="Reflections" />
            <StatCard value={stats?.journal_entries ?? 0} label="Journal entries" />
          </View>

          {/* Badges */}
          <Text style={styles.badgesHeading}>Badges</Text>
          <View style={styles.badgesGrid}>
            {ALL_BADGES.map((badge) => {
              const earned = earnedIds.has(badge.id);
              return (
                <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                  <Text style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>{badge.icon}</Text>
                  <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>{badge.label}</Text>
                  <Text style={[styles.badgeDesc, !earned && styles.badgeDescLocked]}>{badge.desc}</Text>
                  {!earned && (
                    <View style={styles.lockPill}>
                      <Text style={styles.lockText}>Locked</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 56, gap: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  backBtn: {
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
  backText: { color: C.textMuted, fontSize: 13, fontWeight: '500' },
  title: { color: C.text, fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
  headerSpacer: { width: 72 },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingBottom: 48, gap: 24 },

  streakHero: {
    backgroundColor: '#FFF8F0',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFCC80',
    padding: 32,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  streakIcon: { fontSize: 40 },
  streakCount: { color: C.text, fontSize: 64, fontWeight: '800', lineHeight: 76 },
  streakSubLabel: { color: C.textMuted, fontSize: 15, fontWeight: '500', letterSpacing: 0.3 },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: { color: C.text, fontSize: 28, fontWeight: '800' },
  statLabel: { color: C.textDim, fontSize: 12, fontWeight: '500', textAlign: 'center' },

  badgesHeading: {
    color: C.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  badgesGrid: { gap: 10 },
  badgeCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeCardLocked: {
    backgroundColor: C.bg,
    shadowOpacity: 0,
    elevation: 0,
  },
  badgeIcon: { fontSize: 26 },
  badgeIconLocked: { opacity: 0.3 },
  badgeLabel: { color: C.text, fontSize: 15, fontWeight: '700' },
  badgeLabelLocked: { color: C.textDim },
  badgeDesc: { color: C.textMuted, fontSize: 13, lineHeight: 20 },
  badgeDescLocked: { color: C.textDim },
  lockPill: {
    alignSelf: 'flex-start',
    backgroundColor: C.surfaceHigh,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  lockText: { color: C.textDim, fontSize: 11, fontWeight: '600' },
});
