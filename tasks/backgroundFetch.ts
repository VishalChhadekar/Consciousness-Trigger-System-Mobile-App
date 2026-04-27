import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_BASE } from '../constants/api';

export const BACKGROUND_FETCH_TASK = 'consciousness-trigger-fetch';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

// TaskManager.defineTask must be called at module level before any registration.
// Wrap in try-catch so Expo Go doesn't hard-crash on import.
try {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    const userId = await SecureStore.getItemAsync('user_id');
    if (!userId) return BackgroundFetch.BackgroundFetchResult.NoData;

    const hour = new Date().getHours();
    if (hour < 7 || hour > 22) return BackgroundFetch.BackgroundFetchResult.NoData;

    const dateKey = `generate_count_${new Date().toDateString()}`;
    const [countStr, lastTs] = await Promise.all([
      AsyncStorage.getItem(dateKey),
      AsyncStorage.getItem('last_generate_ts'),
    ]);
    const count = countStr ? parseInt(countStr, 10) : 0;
    if (count >= 5) return BackgroundFetch.BackgroundFetchResult.NoData;
    if (lastTs && Date.now() - parseInt(lastTs, 10) < 2 * 60 * 60 * 1000) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    try {
      const res = await fetch(`${API_BASE}/api/generate-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, time_of_day: timeOfDay }),
      });
      const json = await res.json();
      if (!json.data) return BackgroundFetch.BackgroundFetchResult.Failed;

      const { id, content, type } = json.data;

      await Promise.all([
        AsyncStorage.setItem('last_notification_id', id),
        AsyncStorage.setItem('last_notification_content', content),
        AsyncStorage.setItem('last_notification_type', type),
        AsyncStorage.setItem(dateKey, (count + 1).toString()),
        AsyncStorage.setItem('last_generate_ts', Date.now().toString()),
      ]);

      await Notifications.scheduleNotificationAsync({
        content: {
          body: content,
          data: { notification_id: id, content, type },
        },
        trigger: null,
      });

      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  console.warn('[BackgroundFetch] Task definition failed (expected in Expo Go):', e);
}

// ── Registration (call once after push permission is granted)

export async function registerBackgroundTask(): Promise<void> {
  if (IS_EXPO_GO) {
    console.warn('[BackgroundFetch] Not available in Expo Go. Use a development build.');
    return;
  }

  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60 * 120,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (e) {
    console.warn('[BackgroundFetch] Registration failed:', e);
  }
}
