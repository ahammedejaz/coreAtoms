/**
 * notifications.js — Push notification registration and management.
 *
 * Uses Expo Push Notifications (free, unlimited) to send order status
 * updates when the app is backgrounded/closed.
 *
 * Flow: registerForPushNotifications() → savePushToken() → DB → Edge Function → Expo Push API
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase/client';

// ─── Configure notification display behaviour ───────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request permission and get the Expo push token.
 * Returns the token string or null if unavailable.
 */
export async function registerForPushNotifications() {
  // Push only works on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1e3a5f',
      sound: 'default',
    });
  }

  return tokenData.data; // e.g. "ExponentPushToken[xxxxxx]"
}

/**
 * Save push token to Supabase `push_tokens` table.
 * Upserts so re-registration is idempotent.
 */
export async function savePushToken(userId, expoPushToken) {
  if (!userId || !expoPushToken) return;

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        device_name: Device.modelName || 'Unknown',
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_push_token' }
    );

  if (error) {
    console.warn('Failed to save push token:', error.message);
  }
}

/**
 * Remove all push tokens for a user (on sign-out).
 */
export async function removePushToken(userId) {
  if (!userId) return;

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.warn('Failed to remove push tokens:', error.message);
  }
}
