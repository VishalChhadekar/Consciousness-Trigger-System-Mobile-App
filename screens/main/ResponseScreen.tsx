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
import { DomainBadge } from '../../components/DomainBadge';
import { C } from '../../constants/colors';
import { api, ApiError } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

export function ResponseScreen({ navigation, route }: ScreenProps<'Response'>) {
  const { notificationId, content, notificationType } = route.params;
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const text = responseText.trim();
    if (!text) return;
    setLoading(true);
    try {
      const userId = await Storage.getUserId();
      if (userId) {
        await api.sendResponse(userId, notificationId, text);
      }
    } catch (e) {
      // 404 = notification not found → silent dismiss per spec
      if (e instanceof ApiError && e.status === 404) {
        // fall through to navigate
      }
      // other errors: still navigate — response is optional
    } finally {
      navigation.goBack();
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentStyle={styles.container}>
        {/* Close */}
        <TouchableOpacity style={styles.closeRow} onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>Skip</Text>
        </TouchableOpacity>

        {/* Trigger display */}
        <View style={styles.card}>
          {notificationType ? <DomainBadge type={notificationType} /> : null}
          <Text style={styles.triggerText}>{content}</Text>
        </View>

        {/* Response input */}
        <View style={styles.inputArea}>
          <Text style={styles.inputLabel}>Your reflection</Text>
          <TextInput
            style={styles.input}
            placeholder="A few honest words…"
            placeholderTextColor={C.textDim}
            value={responseText}
            onChangeText={setResponseText}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            autoFocus
          />
          <Text style={styles.inputHint}>1–3 sentences is plenty</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!responseText.trim() || loading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!responseText.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color={C.text} />
          ) : (
            <Text style={styles.submitText}>Submit</Text>
          )}
        </TouchableOpacity>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 48, gap: 24 },
  closeRow: { alignItems: 'flex-end' },
  closeText: { color: C.textMuted, fontSize: 15 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 22,
    gap: 14,
  },
  triggerText: {
    color: C.text,
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '400',
  },
  inputArea: { flex: 1, gap: 8 },
  inputLabel: {
    color: C.textDim,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 16,
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
    minHeight: 120,
  },
  inputHint: { color: C.textDim, fontSize: 12 },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnDisabled: { opacity: 0.35 },
  submitText: { color: C.text, fontSize: 16, fontWeight: '500' },
});
