import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { DomainBadge, parseDomain } from '../../components/DomainBadge';
import { C, DOMAIN_COLORS } from '../../constants/colors';
import { Storage, type NotificationRecord } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  if (isYesterday) return `Yesterday · ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

export function NotificationHistoryScreen({ navigation }: ScreenProps<'NotificationHistory'>) {
  const [records, setRecords] = useState<NotificationRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      Storage.getNotificationHistory().then(setRecords);
    }, [])
  );

  function handleItemPress(record: NotificationRecord) {
    if (!record.responded && record.id) {
      navigation.navigate('Response', {
        notificationId: record.id,
        content: record.content,
        notificationType: record.type,
      });
    }
  }

  const today = new Date().toDateString();
  const todayRecords = records.filter((r) => new Date(r.timestamp).toDateString() === today);
  const olderRecords = records.filter((r) => new Date(r.timestamp).toDateString() !== today);

  type Section =
    | { type: 'header'; label: string }
    | { type: 'item'; record: NotificationRecord };

  const sections: Section[] = [];
  if (todayRecords.length > 0) {
    sections.push({ type: 'header', label: 'Today' });
    todayRecords.forEach((r) => sections.push({ type: 'item', record: r }));
  }
  if (olderRecords.length > 0) {
    sections.push({ type: 'header', label: 'Earlier' });
    olderRecords.forEach((r) => sections.push({ type: 'item', record: r }));
  }

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Triggers</Text>
        <View style={styles.headerSpacer} />
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No triggers yet.</Text>
          <Text style={styles.emptySubtitle}>Head back home to generate your first one.</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, i) =>
            item.type === 'header' ? `header-${item.label}` : `${item.record.id}-${i}`
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionLabel}>{item.label}</Text>;
            }

            const { record } = item;
            const pending = !record.responded && Boolean(record.id);
            const domain = record.type ? parseDomain(record.type) : '';
            const accentColor = domain ? (DOMAIN_COLORS[domain] ?? C.border) : C.border;

            return (
              <TouchableOpacity
                style={[styles.card, { borderLeftColor: accentColor }, !pending && styles.cardDimmed]}
                onPress={() => handleItemPress(record)}
                disabled={!pending}
                activeOpacity={pending ? 0.7 : 1}
              >
                <View style={styles.cardHeader}>
                  {record.type ? <DomainBadge type={record.type} /> : <View />}
                  <Text style={styles.timeText}>{formatTime(record.timestamp)}</Text>
                </View>
                <Text style={[styles.contentText, !pending && styles.contentDimmed]} numberOfLines={4}>
                  {record.content}
                </Text>
                <View style={[styles.statusBadge, record.responded ? styles.statusDone : styles.statusPending]}>
                  <Text style={[styles.statusText, record.responded ? styles.statusDoneText : styles.statusPendingText]}>
                    {record.responded ? '✓  Responded' : 'Tap to respond'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
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
  backText: { color: C.textMuted, fontSize: 15 },
  title: { color: C.text, fontSize: 17, fontWeight: '600', letterSpacing: 0.3 },
  headerSpacer: { width: 60 },
  listContent: { paddingBottom: 40 },
  sectionLabel: {
    color: C.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderLeftWidth: 3,
    padding: 18,
    gap: 12,
    marginBottom: 10,
  },
  // Responded cards recede visually so pending ones naturally stand out
  cardDimmed: { opacity: 0.5 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: { color: C.textDim, fontSize: 12 },
  contentText: {
    color: C.text,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  },
  contentDimmed: { color: C.textMuted },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusDone: { backgroundColor: 'rgba(46, 204, 113, 0.10)' },
  statusPending: { backgroundColor: 'rgba(139, 124, 248, 0.12)' },
  statusText: { fontSize: 12, fontWeight: '500' },
  statusDoneText: { color: C.success },
  statusPendingText: { color: C.primary },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: { color: C.textMuted, fontSize: 16, fontWeight: '500' },
  emptySubtitle: { color: C.textDim, fontSize: 14, textAlign: 'center' },
});
