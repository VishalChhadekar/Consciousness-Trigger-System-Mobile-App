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
import { DomainBadge, parseDomain } from '../../components/DomainBadge';
import { C, DOMAIN_COLORS } from '../../constants/colors';
import { api, ApiError } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

export function ResponseScreen({ navigation, route }: ScreenProps<'Response'>) {
  const { notificationId, content, notificationType } = route.params;
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Save to history on mount — covers push notifications and background-fetch taps
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
        // fall through
      }
    } finally {
      navigation.goBack();
    }
  }

  const domain = notificationType ? parseDomain(notificationType) : '';
  const accentColor = domain ? (DOMAIN_COLORS[domain] ?? C.border) : C.border;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Scrollable content so cursor is never hidden behind the keyboard */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <TouchableOpacity style={styles.closeRow} onPress={() => navigation.goBack()}>
            <Text style={styles.closeText}>Skip</Text>
          </TouchableOpacity>

          {/* Trigger card — elevated surface + domain left border */}
          <View style={[styles.card, { borderLeftColor: accentColor }]}>
            {notificationType ? <DomainBadge type={notificationType} /> : null}
            <Text style={styles.triggerText}>{content}</Text>
          </View>

          {/* Response input area */}
          <View style={styles.inputArea}>
            <Text style={styles.inputLabel}>Your reflection</Text>
            <TextInput
              style={styles.input}
              placeholder="A few honest words…"
              placeholderTextColor={C.textDim}
              value={responseText}
              onChangeText={setResponseText}
              multiline
              textAlignVertical="top"
              autoFocus
              // Scroll to end as content grows so cursor stays visible
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            />
            <Text style={styles.inputHint}>1–3 sentences is plenty</Text>
          </View>
        </ScrollView>

        {/* Submit pinned above keyboard — outside ScrollView */}
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
    paddingTop: 48,
    paddingBottom: 16,
    gap: 24,
  },
  closeRow: { alignItems: 'flex-end' },
  closeText: { color: C.textMuted, fontSize: 15 },
  card: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 14,
    borderLeftWidth: 3,
    padding: 22,
    gap: 14,
  },
  triggerText: {
    color: C.text,
    fontSize: 20,
    lineHeight: 32,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  inputArea: { gap: 10 },
  inputLabel: {
    color: C.textDim,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 16,
    color: C.text,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 130,
  },
  inputHint: { color: C.textDim, fontSize: 12 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
});
