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
import { C, DOMAIN_COLORS } from '../../constants/colors';
import { api } from '../../services/api';
import { Storage } from '../../services/storage';
import type { ScreenProps } from '../../navigation/types';

const DOMAINS = [
  { key: 'work', label: 'Work', hint: 'role, what matters, current focus' },
  { key: 'business', label: 'Business', hint: 'side ventures, co-ownership, stage' },
  { key: 'fitness', label: 'Fitness', hint: 'routine, goals, current level' },
  { key: 'creative', label: 'Creative', hint: 'what you\'re learning or making' },
  { key: 'mental', label: 'Mental', hint: 'presence, patterns, current work' },
  { key: 'life', label: 'Life', hint: 'balance, rest, what grounds you' },
] as const;

export function LifeContextScreen({ navigation, route }: ScreenProps<'LifeContext'>) {
  const { userId } = route.params;

  const [domains, setDomains] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState('');
  const [constraints, setConstraints] = useState('');
  const [values, setValues] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setDomain(key: string, val: string) {
    setDomains((prev) => ({ ...prev, [key]: val }));
  }

  const hasMinimal = Object.keys(domains).length >= 2 && focus.trim();

  async function handleContinue() {
    setLoading(true);
    setError('');
    try {
      await api.setUserContext({
        user_id: userId,
        context_json: {
          domains,
          current_focus: focus.trim(),
          constraints: constraints.split(',').map((s) => s.trim()).filter(Boolean),
          values: values.split(',').map((s) => s.trim()).filter(Boolean),
          signals_of_progress: [],
        },
      });
      // Mark onboarding complete here — all essential data is now saved.
      // PermissionsScreen is optional notification setup, not a setup gate.
      await Storage.setOnboarded();
      navigation.navigate('Permissions', { userId });
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.container}>
      <Text style={styles.step}>3 / 4</Text>
      <Text style={styles.heading}>Your life context</Text>
      <Text style={styles.sub}>
        Brief descriptions across the areas you care about. The more honest, the better the
        triggers.
      </Text>

      {DOMAINS.map(({ key, label, hint }) => (
        <View key={key} style={styles.field}>
          <Text style={[styles.fieldLabel, { color: DOMAIN_COLORS[key] ?? C.textMuted }]}>
            {label}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={hint}
            placeholderTextColor={C.textDim}
            value={domains[key] ?? ''}
            onChangeText={(v) => setDomain(key, v)}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Current focus</Text>
        <TextInput
          style={styles.input}
          placeholder="Transitioning from reactive work to intentional building"
          placeholderTextColor={C.textDim}
          value={focus}
          onChangeText={setFocus}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Constraints</Text>
        <TextInput
          style={styles.input}
          placeholder="limited evening energy, warehouse ops take unexpected time"
          placeholderTextColor={C.textDim}
          value={constraints}
          onChangeText={setConstraints}
        />
        <Text style={styles.hint}>comma-separated</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Values</Text>
        <TextInput
          style={styles.input}
          placeholder="depth over breadth, intentional living, physical presence"
          placeholderTextColor={C.textDim}
          value={values}
          onChangeText={setValues}
        />
        <Text style={styles.hint}>comma-separated</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, (!hasMinimal || loading) && styles.btnDisabled]}
        onPress={handleContinue}
        disabled={!hasMinimal || loading}
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
  container: { paddingTop: 48, gap: 20 },
  step: { color: C.textDim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  heading: { color: C.text, fontSize: 26, fontWeight: '600', marginBottom: 4 },
  sub: { color: C.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  field: { gap: 6 },
  fieldLabel: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: { color: C.textDim, fontSize: 11, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
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
