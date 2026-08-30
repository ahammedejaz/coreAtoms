/**
 * haptics.js — Haptic feedback utility.
 *
 * Wraps expo-haptics with a safe fallback so the app never crashes
 * if haptics are unavailable (e.g., simulator, unsupported device).
 */
import * as Haptics from 'expo-haptics';

/** Light tap — use for toggles, selections */
export function hapticLight() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
}

/** Medium tap — use for add-to-cart, confirm actions */
export function hapticMedium() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
}

/** Heavy tap — use for destructive or important actions */
export function hapticHeavy() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
}

/** Success notification — use for order placed, review submitted */
export function hapticSuccess() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
}

/** Error notification — use for validation errors */
export function hapticError() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
}

/** Selection changed — use for picker/filter changes */
export function hapticSelection() {
  try { Haptics.selectionAsync(); } catch {}
}
