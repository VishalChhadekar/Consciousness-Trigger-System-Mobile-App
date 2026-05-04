import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DOMAIN_COLORS } from '../constants/colors';

export function parseDomain(type: string): string {
  const parts = type.split(' | ');
  return parts.length > 1 ? parts[1].trim().toLowerCase() : '';
}

export function DomainBadge({ type }: { type: string }) {
  const domain = parseDomain(type);
  if (!domain) return null;

  const color = DOMAIN_COLORS[domain] ?? '#666';

  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[styles.label, { color }]}>{domain}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
});
