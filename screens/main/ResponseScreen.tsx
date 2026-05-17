import React, { useState, useRef, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { DomainBadge } from '../../components/DomainBadge';
import { C } from '../../constants/colors';
import { api, ApiError } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

type Phase = 'writing' | 'submitting' | 'submitted' | 'followup-loading' | 'followup-done';
type ActionsPhase = 'idle' | 'loading' | 'done' | 'error';

export function ResponseScreen({ navigation, route }: ScreenProps<'Response'>) {
  const { notificationId, content, notificationType } = route.params;
  const [responseText, setResponseText] = useState('');
  const [submittedText, setSubmittedText] = useState('');
  const [followUpText, setFollowUpText] = useState('');
  const [phase, setPhase] = useState<Phase>('writing');
  const [toast, setToast] = useState('');
  const [userId, setUserId] = useState('');
  const [actionsPhase, setActionsPhase] = useState<ActionsPhase>('idle');
  const [extractedActions, setExtractedActions] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Storage.getUserId().then((uid) => { if (uid) setUserId(uid); });
    if (notificationId) {
      Storage.addNotificationToHistory(notificationId, content, notificationType).catch(() => null);
    }
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }

  async function handleSubmit() {
    const text = responseText.trim();
    if (!text) return;
    setPhase('submitting');
    try {
      if (userId) await api.sendResponse(userId, notificationId, text);
      await Storage.markNotificationResponded(notificationId);
      setSubmittedText(text);
      setPhase('submitted');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setSubmittedText(text);
        setPhase('submitted');
      } else {
        setPhase('writing');
      }
    }
  }

  async function handleFollowUp() {
    if (!userId) return;
    setPhase('followup-loading');
    try {
      const res = await api.generateFollowUp(userId, notificationId);
      setFollowUpText(res.follow_up);
      setPhase('followup-done');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setPhase('submitted');
      if (e instanceof ApiError && e.status === 503) {
        showToast('Follow-up unavailable right now.');
      }
    }
  }

  async function handleExtractActions() {
    if (!userId) return;
    setActionsPhase('loading');
    try {
      const res = await api.extractActions(userId, notificationId || undefined);
      setExtractedActions(res.actions);
      setActionsPhase('done');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setActionsPhase('error');
    }
  }

  const isWriting = phase === 'writing';
  const isSubmitting = phase === 'submitting';
  const isDone = phase === 'submitted' || phase === 'followup-loading' || phase === 'followup-done';

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
          bounces={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.screenTitle}>Your Reflection</Text>
            {isDone ? (
              <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.skipText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()} disabled={isSubmitting}>
                <Text style={[styles.skipText, isSubmitting && { opacity: 0.4 }]}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Trigger card */}
          <View style={styles.triggerCard}>
            {notificationType ? <DomainBadge type={notificationType} /> : null}
            <Text style={styles.triggerText}>{content}</Text>
          </View>

          {/* Writing phase: input */}
          {isWriting || isSubmitting ? (
            <View style={styles.inputArea}>
              <Text style={styles.inputLabel}>Write your response</Text>
              <TextInput
                style={styles.input}
                placeholder="A few honest words…"
                placeholderTextColor={C.textDim}
                value={responseText}
                onChangeText={setResponseText}
                multiline
                textAlignVertical="top"
                autoFocus={isWriting}
                editable={isWriting}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              />
              <Text style={styles.inputHint}>1–3 sentences is plenty</Text>
            </View>
          ) : null}

          {/* Submitted / follow-up phase: show submitted text */}
          {isDone ? (
            <View style={styles.submittedCard}>
              <Text style={styles.submittedLabel}>Your response</Text>
              <Text style={styles.submittedText}>{submittedText}</Text>
            </View>
          ) : null}

          {/* Follow-up insight card */}
          {phase === 'followup-done' && followUpText ? (
            <View style={styles.insightCard}>
              <Text style={styles.insightText}>{followUpText}</Text>
            </View>
          ) : null}

          {/* "Get deeper insight" button — shown only in submitted state */}
          {phase === 'submitted' ? (
            <TouchableOpacity style={styles.insightBtn} onPress={handleFollowUp}>
              <Text style={styles.insightBtnText}>✦  Get deeper insight</Text>
            </TouchableOpacity>
          ) : null}

          {/* Follow-up loading indicator */}
          {phase === 'followup-loading' ? (
            <View style={styles.followUpLoading}>
              <ActivityIndicator color={C.primary} />
              <Text style={styles.followUpLoadingText}>Generating insight…</Text>
            </View>
          ) : null}

          {/* Extract intentions — shown after submit, below follow-up content */}
          {isDone && phase !== 'followup-loading' ? (
            <View style={styles.intentionsSection}>
              {actionsPhase === 'idle' || actionsPhase === 'error' ? (
                <>
                  <TouchableOpacity
                    style={styles.intentionsBtn}
                    onPress={handleExtractActions}
                  >
                    <Text style={styles.intentionsBtnText}>◎  Extract intentions</Text>
                  </TouchableOpacity>
                  {actionsPhase === 'error' ? (
                    <Text style={styles.intentionsError}>Could not extract intentions. Try again.</Text>
                  ) : null}
                </>
              ) : actionsPhase === 'loading' ? (
                <View style={styles.intentionsLoading}>
                  <ActivityIndicator size="small" color={C.primary} />
                  <Text style={styles.intentionsLoadingText}>Extracting from your response…</Text>
                </View>
              ) : extractedActions.length === 0 ? (
                <View style={styles.intentionsResult}>
                  <Text style={styles.intentionsLabel}>From your response</Text>
                  <Text style={styles.intentionsEmpty}>No specific intentions found in your response.</Text>
                </View>
              ) : (
                <View style={styles.intentionsResult}>
                  <Text style={styles.intentionsLabel}>From your response</Text>
                  {extractedActions.map((action, i) => (
                    <View key={i} style={styles.intentionRow}>
                      <Text style={styles.intentionBullet}>•</Text>
                      <Text style={styles.intentionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* Toast */}
          {toast ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Pinned footer */}
        {isWriting || isSubmitting ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitBtn, (!responseText.trim() || isSubmitting) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={!responseText.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {phase === 'followup-done' ? (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  kav: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 20 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: 0.2 },
  skipBtn: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  skipText: { color: C.textMuted, fontSize: 13, fontWeight: '500' },

  triggerCard: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 22,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  triggerText: { color: C.text, fontSize: 19, lineHeight: 30, fontWeight: '500' },

  inputArea: { gap: 10 },
  inputLabel: { color: C.textMuted, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600' },
  input: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 18,
    color: C.text,
    fontSize: 16,
    lineHeight: 26,
    minHeight: 140,
    elevation: 1,
  },
  inputHint: { color: C.textDim, fontSize: 12 },

  submittedCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  submittedLabel: { color: C.textDim, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  submittedText: { color: C.text, fontSize: 16, lineHeight: 26 },

  insightBtn: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1.5,
    borderColor: C.primary + '55',
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  insightBtnText: { color: C.primary, fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },

  followUpLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  followUpLoadingText: { color: C.textMuted, fontSize: 14 },

  insightCard: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: C.border,
    borderLeftColor: C.primary,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightText: { color: C.text, fontSize: 16, lineHeight: 26, fontStyle: 'italic' },

  intentionsSection: { gap: 10 },
  intentionsBtn: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
  },
  intentionsBtnText: { color: C.textMuted, fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
  intentionsLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  intentionsLoadingText: { color: C.textMuted, fontSize: 13 },
  intentionsError: { color: C.danger, fontSize: 12, textAlign: 'center' },
  intentionsResult: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 10,
  },
  intentionsLabel: {
    color: C.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  intentionsEmpty: { color: C.textDim, fontSize: 14, fontStyle: 'italic' },
  intentionRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  intentionBullet: { color: C.primary, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  intentionText: { flex: 1, color: C.text, fontSize: 15, lineHeight: 24 },

  toast: {
    backgroundColor: C.text,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  toastText: { color: C.bg, fontSize: 13, fontWeight: '500' },

  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  submitBtn: {
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
  btnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  doneBtn: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
  },
  doneBtnText: { color: C.text, fontSize: 16, fontWeight: '600' },
});
