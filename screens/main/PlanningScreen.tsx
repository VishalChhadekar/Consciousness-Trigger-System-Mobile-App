import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { api, type Plan, todayISO } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

type PlanType = 'day' | 'week' | 'month';

const TABS: { type: PlanType; label: string; empty: string }[] = [
  { type: 'day', label: 'Today', empty: 'What do you want to protect today?' },
  { type: 'week', label: 'This Week', empty: 'What matters most this week?' },
  { type: 'month', label: 'This Month', empty: 'What are you building toward this month?' },
];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function PlanningScreen({ navigation }: ScreenProps<'Planning'>) {
  const [userId, setUserId] = useState('');
  const [activeType, setActiveType] = useState<PlanType>('day');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Cache loaded plans so tab switching doesn't re-fetch unnecessarily
  const planCache = useRef<Record<PlanType, string | null>>({ day: null, week: null, month: null });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      Storage.getUserId().then((uid) => {
        if (uid) {
          setUserId(uid);
          loadPlan(uid, activeType);
        }
      });
    }, [])
  );

  async function loadPlan(uid: string, type: PlanType) {
    if (planCache.current[type] !== null) {
      setText(planCache.current[type] ?? '');
      return;
    }
    setLoading(true);
    try {
      const plan = await api.getPlan(uid, type, todayISO());
      const content = plan?.content ?? '';
      planCache.current[type] = content;
      setText(content);
    } catch {
      setText('');
    } finally {
      setLoading(false);
    }
  }

  function handleTabPress(type: PlanType) {
    if (type === activeType) return;
    // Flush any pending save before switching
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (text !== (planCache.current[activeType] ?? '')) {
        doSave(userId, activeType, text);
      }
    }
    planCache.current[activeType] = text;
    setActiveType(type);
    setText(planCache.current[type] ?? '');
    if (planCache.current[type] === null) {
      loadPlan(userId, type);
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    scheduleSave(value);
  }

  function scheduleSave(value: string) {
    if (!userId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      doSave(userId, activeType, value);
    }, 800);
  }

  async function doSave(uid: string, type: PlanType, content: string) {
    if (!uid) return;
    setSaveStatus('saving');
    try {
      await api.savePlan(uid, type, content, todayISO());
      planCache.current[type] = content;
      setSaveStatus('saved');
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  }

  const activeTab = TABS.find((t) => t.type === activeType)!;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Planning</Text>
          <View style={styles.saveIndicator}>
            {saveStatus === 'saving' && <ActivityIndicator size="small" color={C.primary} />}
            {saveStatus === 'saved' && <Text style={styles.savedText}>Saved</Text>}
            {saveStatus === 'error' && <Text style={styles.errorText}>Error</Text>}
          </View>
        </View>

        {/* Type tabs */}
        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const active = activeType === tab.type;
            return (
              <TouchableOpacity
                key={tab.type}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => handleTabPress(tab.type)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={C.primary} />
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={handleTextChange}
                placeholder={activeTab.empty}
                placeholderTextColor={C.textDim}
                multiline
                textAlignVertical="top"
                autoFocus={false}
              />
              {text.length > 0 && (
                <Text style={styles.charCount}>{text.length} characters</Text>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  kav: { flex: 1, paddingHorizontal: 24, paddingTop: 56 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  saveIndicator: { width: 56, alignItems: 'flex-end' },
  savedText: { color: C.success, fontSize: 12, fontWeight: '600' },
  errorText: { color: C.danger, fontSize: 12, fontWeight: '600' },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 80, gap: 12 },

  loadingState: { paddingTop: 40, alignItems: 'center' },

  input: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 20,
    color: C.text,
    fontSize: 16,
    lineHeight: 28,
    minHeight: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  charCount: { color: C.textDim, fontSize: 11, textAlign: 'right', paddingRight: 4 },
});
