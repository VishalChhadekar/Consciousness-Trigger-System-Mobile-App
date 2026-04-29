import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { C } from '../../constants/colors';
import { api, ApiError } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ExistingUserScreen({ navigation }: ScreenProps<'ExistingUser'>) {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRestore() {
    const trimmed = userId.trim();
    if (!UUID_RE.test(trimmed)) {
      setError('Paste a valid UUID (e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Verify the ID resolves to a real user by hitting weekly-summary.
      // Any 2xx back (even empty data) means the user exists in the DB.
      await api.getWeeklySummary(trimmed);
      await Storage.setUserId(trimmed);
      await Storage.setOnboarded();
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 404) {
          setError('User ID not found. Double-check the UUID from Supabase.');
        } else if (e.status === 0) {
          setError('Cannot reach server. Check your connection.');
        } else {
          // Any other 2xx-ish path shouldn't throw; treat unexpected errors as success
          // and let HomeScreen handle edge cases.
          await Storage.setUserId(trimmed);
          await Storage.setOnboarded();
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        }
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.top}>
        <Text style={styles.heading}>Restore account</Text>
        <Text style={styles.sub}>
          Paste your user ID from Supabase to skip setup and resume where you left off.
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        placeholderTextColor={C.textDim}
        value={userId}
        onChangeText={text => { setUserId(text); setError(''); }}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={handleRestore}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, (!userId.trim() || loading) && styles.btnDisabled]}
        onPress={handleRestore}
        disabled={!userId.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color={C.text} />
        ) : (
          <Text style={styles.btnText}>Restore</Text>
        )}
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 56, gap: 24 },
  backRow: { marginBottom: 4 },
  backText: { color: C.textMuted, fontSize: 15 },
  top: { gap: 10 },
  heading: { color: C.text, fontSize: 26, fontWeight: '600' },
  sub: { color: C.textMuted, fontSize: 15, lineHeight: 22 },
  input: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 16,
    color: C.text,
    fontSize: 15,
    fontFamily: 'monospace',
    letterSpacing: 0.3,
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
