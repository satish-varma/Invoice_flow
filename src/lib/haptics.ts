/**
 * Native Haptic Feedback Utility for mobile browsers & PWAs.
 * Safe fallback for desktop or browsers without vibration API.
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined') return;

  const patterns: Record<HapticType, number | number[]> = {
    light: 12,        // Quick subtle tick (steppers, tabs)
    medium: 25,       // Standard button press (check in, capture)
    heavy: 45,        // Primary confirmations
    success: [15, 40, 25], // Double-tap pulse on successful save
    warning: [30, 50, 30], // Alert/boundary pulse
  };

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(patterns[type]);
    }
  } catch {
    // Silently ignore if permission denied or unsupported
  }
}
