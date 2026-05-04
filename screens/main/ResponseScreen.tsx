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

export function ResponseScreen({ navigation, route }: ScreenProps<'Response'>) {
  const { notificationId, content, notificationType } = route.params;
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (notificationId) {
      Storage.addNotificationToHistory(notificationId, content, notificationType).catch(() => null);
    }
  }, []);

  async function handleSubmit() {
    const text = responseText.trim();
    if (!text) return;
    setLoading(true);
    try {
      const userId = await Storage.getUserId();
      if (userId) {
        await api.sendResponse(userId, notificationId, text);
      }
      await Storage.markNotificationResponded(notificationId);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // silent dismiss
      }
    } finally {
      navigation.goBack();
    }
  }

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
          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={styles.screenTitle}>Your Reflection</Text>
            <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Trigger card */}
          <View style={styles.card}>
            {notificationType ? <DomainBadge type={notificationType} /> : null}
            <Text style={styles.triggerText}>{content}</Text>
          </View>

          {/* Response input */}
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
              autoFocus
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            />
            <Text style={styles.inputHint}>1–3 sentences is plenty</Text>
          </View>
        </ScrollView>

        {/* Pinned submit button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, (!responseText.trim() || loading) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!responseText.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  kav: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
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
  card: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  triggerText: {
    color: C.text,
    fontSize: 20,
    lineHeight: 32,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  inputArea: { gap: 10 },
  inputLabel: {
    color: C.textMuted,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
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
    minHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputHint: { color: C.textDim, fontSize: 12 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
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
});
