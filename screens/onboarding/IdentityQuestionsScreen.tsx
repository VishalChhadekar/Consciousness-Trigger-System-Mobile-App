import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { C } from '../../constants/colors';
import { api } from '../../services/api';
import type { ScreenProps } from '../../navigation/types';

const QUESTIONS = [
  {
    prompt: 'How would you describe your working style and core values?',
    hint: 'systematic, private, deep work focused…',
    field: 'core_traits' as const,
  },
  {
    prompt: 'What gives you real fulfillment?',
    hint: 'building things that last, physical strength…',
    field: 'fulfillment_sources' as const,
  },
  {
    prompt: 'What drains you most about your days?',
    hint: 'shallow reactive work, context switching…',
    field: 'frustrations' as const,
  },
  {
    prompt: 'Where are you right now in life — what direction are you heading?',
    hint: 'transitioning from execution to building my own things…',
    field: 'current_phase' as const,
  },
  {
    prompt: "What patterns do you fall into that you'd rather not?",
    hint: 'consuming without creating, avoiding hard decisions…',
    field: 'anti_patterns' as const,
  },
  {
    prompt: 'In one sentence — how do you want to be?',
    hint: 'a disciplined builder who acts with intention…',
    field: 'preferred_identity' as const,
  },
] as const;

type Answers = Record<string, string>;

export function IdentityQuestionsScreen({ navigation, route }: ScreenProps<'IdentityQuestions'>) {
  const { userId } = route.params;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const q = QUESTIONS[step];
  const current = answers[q.field] ?? '';
  const isLast = step === QUESTIONS.length - 1;

  function handleNext() {
    if (!current.trim()) return;
    if (!isLast) {
      setStep((s) => s + 1);
    } else {
      submit();
    }
  }

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const a = answers;
      await api.seedIdentity({
        user_id: userId,
        core_traits: { description: a.core_traits ?? '' },
        fulfillment_sources: { description: a.fulfillment_sources ?? '' },
        frustrations: { main: a.frustrations ?? '' },
        current_phase: { description: a.current_phase ?? '' },
        anti_patterns: { common: a.anti_patterns ?? '' },
        preferred_identity: a.preferred_identity ?? '',
      });
      navigation.navigate('LifeContext', { userId });
    } catch {
      setError('Failed to save. Try again.');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentStyle={styles.container}>
        <View style={styles.top}>
          <Text style={styles.step}>
            {step + 1} / {QUESTIONS.length}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${((step + 1) / QUESTIONS.length) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.prompt}>{q.prompt}</Text>
          <TextInput
            key={q.field}
            style={styles.input}
            placeholder={q.hint}
            placeholderTextColor={C.textDim}
            value={current}
            onChangeText={(val) => setAnswers((prev) => ({ ...prev, [q.field]: val }))}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btn, (!current.trim() || loading) && styles.btnDisabled, step > 0 && styles.btnFlex]}
            onPress={handleNext}
            disabled={!current.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={C.text} />
            ) : (
              <Text style={styles.btnText}>{isLast ? 'Done' : 'Next'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 48, gap: 32 },
  top: { gap: 12 },
  step: { color: C.textDim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  progressBar: { height: 2, backgroundColor: C.border, borderRadius: 1 },
  progressFill: { height: 2, backgroundColor: C.primary, borderRadius: 1 },
  body: { flex: 1, gap: 20 },
  prompt: { color: C.text, fontSize: 22, fontWeight: '600', lineHeight: 30 },
  input: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 16,
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 110,
  },
  error: { color: C.danger, fontSize: 13 },
  footer: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  backBtn: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  backText: { color: C.textMuted, fontSize: 15 },
  btn: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnFlex: { flex: 1 },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: C.text, fontSize: 16, fontWeight: '500' },
});
