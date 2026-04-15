/** webkit-prefixed AudioContext used by older Safari / iOS WebView. */
interface WindowWithWebkit extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function getAudioContext(): AudioContext | null {
  const win = window as WindowWithWebkit;
  const Ctor = win.AudioContext ?? win.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 — high
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // slide up

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
}

/** Two-tone descending warning chime — distinct from success (ascending) and error (square). */
export function playWarningSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Descending two-tone: 660 Hz → 440 Hz (warning interval)
    playTone(660, ctx.currentTime, 0.14);
    playTone(440, ctx.currentTime + 0.18, 0.18);

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
}

export function playErrorSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime); // low pitch
    osc.frequency.setValueAtTime(250, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
}
