const HAPTICS_PREF_KEY = 'postplus_haptics_enabled';
let lastHapticTimestamp = 0;

export type HapticIntensity = 'light' | 'medium' | 'success';

export const isHapticsEnabled = (): boolean => {
  try {
    return localStorage.getItem(HAPTICS_PREF_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const setHapticsEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(HAPTICS_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
};

export const triggerHapticFeedback = (
  intensity: HapticIntensity = 'light'
): void => {
  if (!isHapticsEnabled()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  const now = Date.now();
  if (now - lastHapticTimestamp < 32) {
    return; // Debounce nested clickable elements
  }
  lastHapticTimestamp = now;

  try {
    if (intensity === 'success') {
      navigator.vibrate([12, 28, 18]);
    } else if (intensity === 'medium') {
      navigator.vibrate(20);
    } else {
      navigator.vibrate(12);
    }
  } catch {
    // Some browsers silently disallow vibrate before user activation
  }
};

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
  'summary',
  '.cursor-pointer',
].join(', ');

/**
 * Installs a global capture listener so every click/tap on any clickable UI element
 * triggers crisp tactile micro-vibration feedback.
 */
export const installGlobalClickHaptics = (): (() => void) => {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
    if (!interactive) return;
    if (
      interactive.hasAttribute('disabled') ||
      interactive.getAttribute('aria-disabled') === 'true'
    ) {
      return;
    }
    triggerHapticFeedback('light');
  };

  document.addEventListener('click', handleClick, { capture: true, passive: true });
  return () => {
    document.removeEventListener('click', handleClick, { capture: true });
  };
};
