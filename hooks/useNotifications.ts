import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { type EventSubscription } from 'expo-modules-core';
import { Platform, Alert } from 'react-native';
import { navigationRef } from '../navigation/navigationRef';
import { api } from '../services/api';

// Expo Go SDK 53+ removed Android remote push support.
// Local notification scheduling still works; push tokens do not.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

if (!IS_EXPO_GO) {
  // Only safe to call at module level in a real build.
  // In Expo Go this triggers an internal addPushTokenListener call that crashes.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function useNotifications() {
  const receivedSub = useRef<EventSubscription | undefined>(undefined);
  const responseSub = useRef<EventSubscription | undefined>(undefined);

  useEffect(() => {
    if (IS_EXPO_GO) {
      // Set handler inside effect so it runs after native module fully initialises.
      // Local notifications still work in Expo Go; only remote tokens are gone.
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
      } catch {
        // Expo Go SDK 53 — notifications not fully available, continue without.
        return;
      }
    }

    receivedSub.current = Notifications.addNotificationReceivedListener((notification) => {
      const body = notification.request.content.body ?? '';
      if (body) Alert.alert('', body);
    });

    responseSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.notification_id && navigationRef.isReady()) {
        navigationRef.navigate('Response', {
          notificationId: data.notification_id,
          content: data.content ?? '',
          notificationType: data.type ?? '',
        });
      }
    });

    return () => {
      receivedSub.current?.remove();
      responseSub.current?.remove();
    };
  }, []);
}

// ── Permission + token registration

export async function registerForPushNotifications(): Promise<string | null> {
  if (IS_EXPO_GO) {
    console.warn(
      '[Push] Expo Go SDK 53+ does not support Android remote push tokens.\n' +
        'Run `npx expo run:android` to use a development build instead.'
    );
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[Push] Physical device required for push tokens.');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }

  if (final !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    'your-project-id'; // run `eas init` to populate

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  console.log('[Push] Token:', data);
  return data;
}

// Call this once after the user is known (onboarding complete or restore account).
// Idempotent — the backend upserts the token so calling it multiple times is safe.
export async function ensurePushTokenRegistered(userId: string): Promise<void> {
  if (IS_EXPO_GO || !Device.isDevice || Platform.OS === 'web') return;
  try {
    const token = await registerForPushNotifications();
    if (token) {
      await api.registerDeviceToken(userId, token);
      console.log('[Push] Token registered with backend.');
    }
  } catch (e) {
    // Non-fatal — will retry on next app launch.
    console.warn('[Push] ensurePushTokenRegistered failed (non-fatal):', e);
  }
}
