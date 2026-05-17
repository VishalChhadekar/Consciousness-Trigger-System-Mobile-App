import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { api, type JournalTemplate, type JournalEntry, todayISO } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

const RAW_THOUGHTS: JournalTemplate = {
  id: '',
  label: 'Raw Thoughts',
  prompt: "What's on your mind right now? No filter, no structure — just write.",
};

function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function categoryOf(id: string): string {
  if (id.startsWith('morning')) return 'Morning';
  if (id.startsWith('midday')) return 'Midday';
  if (id.startsWith('evening')) return 'Evening';
  if (id.startsWith('growth') || id.startsWith('week') || id.startsWith('month')) return 'Growth';
  return 'Open';
}

export function JournalScreen({ navigation }: ScreenProps<'Journal'>) {
  const [userId, setUserId] = useState('');
  const [templates, setTemplates] = useState<JournalTemplate[]>([]);
  const [selected, setSelected] = useState<JournalTemplate>(RAW_THOUGHTS);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Storage.getUserId().then((uid) => {
      if (!uid) return;
      setUserId(uid);
      api.getJournalTemplates(uid)
        .then((t) => setTemplates(t ?? []))
        .catch(() => null);
    });
  }, []);

  async function loadEntries(uid?: string) {
    const id = uid ?? userId;
    if (!id) return;
    setLoadingEntries(true);
    try {
      const data = await api.getJournalEntries(id, todayISO());
      setEntries(data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      Storage.getUserId().then((uid) => {
        if (uid) loadEntries(uid);
      });
    }, [userId])
  );

  async function handleSave() {
    const body = text.trim();
    if (!body || !userId) return;
    setSaving(true);
    try {
      await api.saveJournalEntry(
        userId,
        body,
        selected.id || undefined,
        todayISO()
      );
      setText('');
      setSelected(RAW_THOUGHTS);
      await loadEntries();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch {
      // silent — user can retry
    } finally {
      setSaving(false);
    }
  }

  // Group templates by category for ordered display
  const categoryOrder = ['Morning', 'Midday', 'Evening', 'Growth', 'Open'];
  const allChips = [RAW_THOUGHTS, ...templates].sort((a, b) => {
    const ca = categoryOrder.indexOf(categoryOf(a.id));
    const cb = categoryOrder.indexOf(categoryOf(b.id));
    return ca - cb;
  });

  const today = todayISO();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Journal</Text>
              <Text style={styles.dateLabel}>{new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {/* Template chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {allChips.map((t) => {
              const active = selected.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id || 'raw'}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelected(t)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Prompt */}
          <Text style={styles.prompt}>{selected.prompt}</Text>

          {/* Text input */}
          <TextInput
            style={styles.input}
            placeholder="Start writing…"
            placeholderTextColor={C.textDim}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, (!text.trim() || saving) && styles.btnDisabled]}
            onPress={handleSave}
            disabled={!text.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Entry</Text>
            )}
          </TouchableOpacity>

          {/* Today's entries */}
          {(loadingEntries || entries.length > 0) ? (
            <View style={styles.entriesSection}>
              <Text style={styles.entriesSectionLabel}>Earlier today</Text>
              {loadingEntries ? (
                <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />
              ) : (
                entries.map((entry) => (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryMeta}>
                      {entry.template_id ? (
                        <View style={styles.entryTemplatePill}>
                          <Text style={styles.entryTemplateText}>
                            {templates.find((t) => t.id === entry.template_id)?.label ?? entry.template_id}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.entryTemplatePill}>
                          <Text style={styles.entryTemplateText}>Raw Thoughts</Text>
                        </View>
                      )}
                      <Text style={styles.entryTime}>{formatEntryTime(entry.created_at)}</Text>
                    </View>
                    <Text style={styles.entryContent}>{entry.content}</Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  kav: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 80, gap: 20 },

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  backText: { color: C.textMuted, fontSize: 13, fontWeight: '500' },
  headerCenter: { alignItems: 'center', gap: 2 },
  title: { color: C.text, fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
  dateLabel: { color: C.textDim, fontSize: 12 },
  headerSpacer: { width: 72 },

  chipsRow: { paddingVertical: 4, gap: 8 },
  chip: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  chipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.25,
    elevation: 3,
  },
  chipText: { color: C.textMuted, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  prompt: {
    color: C.textMuted,
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
    paddingHorizontal: 4,
  },

  input: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 18,
    color: C.text,
    fontSize: 16,
    lineHeight: 26,
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  entriesSection: { gap: 12 },
  entriesSectionLabel: {
    color: C.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  entryCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  entryMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryTemplatePill: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  entryTemplateText: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  entryTime: { color: C.textDim, fontSize: 12 },
  entryContent: { color: C.text, fontSize: 15, lineHeight: 24 },
});
