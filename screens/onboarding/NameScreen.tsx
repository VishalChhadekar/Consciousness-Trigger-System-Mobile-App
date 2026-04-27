import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Screen } from '../../components/Screen';
import { C } from '../../constants/colors';
import { api, ApiError } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

export function NameScreen({ navigation }: ScreenProps<'Name'>) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      console.log('[NameScreen] Submitting name:', trimmed);
      const user = await api.createUser(trimmed);
      console.log('[NameScreen] User created:', user);
      await Storage.setUserId(user.id);
      navigation.navigate('IdentityQuestions', { userId: user.id });
    } catch (e: any) {
      const msg = e instanceof ApiError
        ? `Server error ${e.status}: ${e.message}`
        : `Unexpected error: ${e?.message ?? e}`;
      console.error('[NameScreen] Failed:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.top}>
        <Text style={styles.step}>1 / 4</Text>
        <Text style={styles.heading}>What's your name?</Text>
        <Text style={styles.sub}>This is a private tool. Just you and your patterns.</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor={C.textDim}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleContinue}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, (!name.trim() || loading) && styles.btnDisabled]}
        onPress={handleContinue}
        disabled={!name.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color={C.text} />
        ) : (
          <Text style={styles.btnText}>Continue</Text>
        )}
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 64, gap: 24 },
  top: { gap: 12, marginBottom: 8 },
  step: { color: C.textDim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  heading: { color: C.text, fontSize: 28, fontWeight: '600' },
  sub: { color: C.textMuted, fontSize: 15, lineHeight: 22 },
  input: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 16,
    color: C.text,
    fontSize: 17,
  },
  error: { color: C.danger, fontSize: 13 },
  btn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: C.text, fontSize: 16, fontWeight: '500' },
});
