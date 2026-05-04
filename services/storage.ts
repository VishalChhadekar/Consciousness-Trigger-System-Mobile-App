import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type NotificationRecord = {
  id: string;
  content: string;
  type: string;
  timestamp: number;
  responded: boolean;
};

// expo-secure-store is native-only. On web (browser testing) fall back to
// AsyncStorage which uses localStorage under the hood.
const secure = {
  get: (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  set: (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
};

export const Storage = {
  // ── User (SecureStore on device, AsyncStorage on web)
  getUserId: () => secure.get('user_id'),
  setUserId: (id: string) => secure.set('user_id', id),

  // ── Onboarding
  isOnboarded: () => AsyncStorage.getItem('onboarding_complete'),
  setOnboarded: () => AsyncStorage.setItem('onboarding_complete', 'true'),

  // ── Last notification state
  getLastNotification: async (): Promise<{
    id: string;
    content: string;
    type: string;
  } | null> => {
    const [id, content, type] = await Promise.all([
      AsyncStorage.getItem('last_notification_id'),
      AsyncStorage.getItem('last_notification_content'),
      AsyncStorage.getItem('last_notification_type'),
    ]);
    if (!id || !content || !type) return null;
    return { id, content, type };
  },
  saveLastNotification: (id: string, content: string, type: string) =>
    Promise.all([
      AsyncStorage.setItem('last_notification_id', id),
      AsyncStorage.setItem('last_notification_content', content),
      AsyncStorage.setItem('last_notification_type', type),
    ]),

  // ── Rate limiting

  // For user-initiated taps: only enforce the daily cap, not the 2-hour gap.
  // The time-gap check is for the background task only (prevents auto-spam).
  canGenerateManual: async (): Promise<boolean> => {
    const dateKey = `generate_count_${new Date().toDateString()}`;
    const countStr = await AsyncStorage.getItem(dateKey);
    const count = countStr ? parseInt(countStr, 10) : 0;
    return count < 5;
  },

  // For background task: enforce both daily cap AND 2-hour minimum interval.
  canGenerate: async (): Promise<boolean> => {
    const hour = new Date().getHours();
    if (hour < 7 || hour > 22) return false;

    const dateKey = `generate_count_${new Date().toDateString()}`;
    const [countStr, lastTs] = await Promise.all([
      AsyncStorage.getItem(dateKey),
      AsyncStorage.getItem('last_generate_ts'),
    ]);

    const count = countStr ? parseInt(countStr, 10) : 0;
    if (count >= 5) return false;
    if (lastTs && Date.now() - parseInt(lastTs, 10) < 2 * 60 * 60 * 1000) return false;
    return true;
  },
  recordGenerate: async (): Promise<void> => {
    const dateKey = `generate_count_${new Date().toDateString()}`;
    const countStr = await AsyncStorage.getItem(dateKey);
    const count = countStr ? parseInt(countStr, 10) : 0;
    await Promise.all([
      AsyncStorage.setItem(dateKey, (count + 1).toString()),
      AsyncStorage.setItem('last_generate_ts', Date.now().toString()),
    ]);
  },

  // ── Notification history (last 30 records, newest first)
  getNotificationHistory: async (): Promise<NotificationRecord[]> => {
    const raw = await AsyncStorage.getItem('notification_history');
    if (!raw) return [];
    try {
      return JSON.parse(raw) as NotificationRecord[];
    } catch {
      return [];
    }
  },

  addNotificationToHistory: async (id: string, content: string, type: string): Promise<void> => {
    if (!id) return;
    const raw = await AsyncStorage.getItem('notification_history');
    const history: NotificationRecord[] = raw ? JSON.parse(raw) : [];
    if (history.some((h) => h.id === id)) return; // deduplicate
    const record: NotificationRecord = { id, content, type, timestamp: Date.now(), responded: false };
    const updated = [record, ...history].slice(0, 30);
    await AsyncStorage.setItem('notification_history', JSON.stringify(updated));
  },

  markNotificationResponded: async (id: string): Promise<void> => {
    if (!id) return;
    const raw = await AsyncStorage.getItem('notification_history');
    if (!raw) return;
    const history: NotificationRecord[] = JSON.parse(raw);
    const updated = history.map((h) => (h.id === id ? { ...h, responded: true } : h));
    await AsyncStorage.setItem('notification_history', JSON.stringify(updated));
  },
};
