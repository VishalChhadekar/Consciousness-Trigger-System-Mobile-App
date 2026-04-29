import { Platform } from 'react-native';

// Switch between these two when testing locally vs production:
// const BASE = 'http://192.168.1.3:3000';              // local — phone on same Wi-Fi
const BASE = 'https://consciousness-trigger-system.vercel.app';

export const API_BASE =
  Platform.OS === 'web'
    ? 'http://localhost:3000'  // browser testing (--web)
    : BASE;                    // phone (Expo Go / APK)
