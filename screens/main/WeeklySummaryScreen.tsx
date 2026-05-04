import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Screen } from '../../components/Screen';
import { C } from '../../constants/colors';
import { api } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function WeeklySummaryScreen({ navigation }: ScreenProps<'WeeklySummary'>) {
  const [summary, setSummary] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const userId = await Storage.getUserId();
      if (!userId) {
        setMessage('No user found.');
        setLoading(false);
        return;
      }
      try {
        const res = await api.getWeeklySummary(userId);
        if (res.data) {
          setSummary(res.data.summary);
          setCachedAt(res.data.created_at);
        } else {
          setMessage(res.message ?? 'No activity in the last 7 days.');
        }
      } catch {
        setMessage('Could not load summary. Try again later.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Screen scroll contentStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>This Week</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator color={C.textMuted} style={styles.loader} />
      ) : summary ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>{summary}</Text>
          {cachedAt && (
            <Text style={styles.cachedLabel}>Generated {formatDate(cachedAt)}</Text>
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{message}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 56, gap: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  backText: { color: C.textMuted, fontSize: 13, fontWeight: '500' },
  heading: { color: C.text, fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  headerSpacer: { width: 72 },
  loader: { marginTop: 40 },
  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    gap: 20,
  },
  summaryText: {
    color: C.text,
    fontSize: 16,
    lineHeight: 28,
  },
  cachedLabel: {
    color: C.textDim,
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyText: { color: C.textMuted, fontSize: 15, lineHeight: 24, textAlign: 'center' },
});
