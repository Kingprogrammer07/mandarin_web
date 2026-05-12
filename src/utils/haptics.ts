export function triggerSoftHaptic() {
  try {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    if (haptic) {
      haptic.impactOccurred('light');
      return;
    }

    if ('vibrate' in navigator) {
      navigator.vibrate(14);
    }
  } catch {
    // Haptics are best-effort and should never block user actions.
  }
}

export function triggerSuccessHaptic() {
  try {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    if (haptic) {
      haptic.notificationOccurred('success');
      return;
    }

    if ('vibrate' in navigator) {
      navigator.vibrate(18);
    }
  } catch {
    // Haptics are best-effort and should never block user actions.
  }
}
