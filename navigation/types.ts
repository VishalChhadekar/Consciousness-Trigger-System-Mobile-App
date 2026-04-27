import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  // Onboarding
  Name: undefined;
  IdentityQuestions: { userId: string };
  LifeContext: { userId: string };
  Permissions: { userId: string };
  // Main
  Home: undefined;
  Response: { notificationId: string; content: string; notificationType: string };
  WeeklySummary: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
