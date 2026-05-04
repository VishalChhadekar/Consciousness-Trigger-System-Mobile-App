// Background task must be imported at module level before registration
import './tasks/backgroundFetch';

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { navigationRef } from './navigation/navigationRef';
import { useNotifications, ensurePushTokenRegistered } from './hooks/useNotifications';
import { Storage } from './services/storage';
import { C } from './constants/colors';

// Onboarding
import { NameScreen } from './screens/onboarding/NameScreen';
import { ExistingUserScreen } from './screens/onboarding/ExistingUserScreen';
import { IdentityQuestionsScreen } from './screens/onboarding/IdentityQuestionsScreen';
import { LifeContextScreen } from './screens/onboarding/LifeContextScreen';
import { PermissionsScreen } from './screens/onboarding/PermissionsScreen';

// Main
import { HomeScreen } from './screens/main/HomeScreen';
import { ResponseScreen } from './screens/main/ResponseScreen';
import { WeeklySummaryScreen } from './screens/main/WeeklySummaryScreen';
import { NotificationHistoryScreen } from './screens/main/NotificationHistoryScreen';

import type { RootStackParamList } from './navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  useNotifications();
  return null;
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    async function resolveRoute() {
      const [onboarded, userId] = await Promise.all([
        Storage.isOnboarded(),
        Storage.getUserId(),
      ]);
      // If either flag is set the user has been through setup before.
      // userId alone handles the case where the app was closed mid-PermissionsScreen
      // and onboarding_complete was never written.
      const done = onboarded === 'true' || Boolean(userId);
      if (done && onboarded !== 'true') {
        await Storage.setOnboarded();
      }
      setInitialRoute(done ? 'Home' : 'Name');
      // Re-register push token on every cold start for existing users.
      // Covers restore-account flow and token rotation after reinstalls.
      if (done && userId) {
        ensurePushTokenRegistered(userId).catch(() => null);
      }
    }
    resolveRoute();
  }, []);

  // Handle cold-start notification tap (app launched from a push).
  // getLastNotificationResponseAsync is native-only — safe to skip on web.
  async function onNavReady() {
    try {
      // eslint-disable-next-line deprecation/deprecation
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.notification_id && navigationRef.isReady()) {
        navigationRef.navigate('Response', {
          notificationId: data.notification_id,
          content: data.content ?? '',
          notificationType: data.type ?? '',
        });
      }
    } catch {
      // Not available on web — silently skip.
    }
  }

  if (!initialRoute) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} onReady={onNavReady}>
        <AppContent />
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, animation: 'fade' }}
        >
          {/* Onboarding */}
          <Stack.Screen name="Name" component={NameScreen} />
          <Stack.Screen name="ExistingUser" component={ExistingUserScreen} />
          <Stack.Screen name="IdentityQuestions" component={IdentityQuestionsScreen} />
          <Stack.Screen name="LifeContext" component={LifeContextScreen} />
          <Stack.Screen name="Permissions" component={PermissionsScreen} />

          {/* Main */}
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen
            name="Response"
            component={ResponseScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="WeeklySummary" component={WeeklySummaryScreen} />
          <Stack.Screen name="NotificationHistory" component={NotificationHistoryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
