/**
 * D.4.1 — Task complete sound (short, pleasant chime).
 * D.4.2 — Error sound (subtle alert).
 *
 * Uses Web Audio API for lightweight synthesized sounds.
 * No external audio files needed — generates tones procedurally.
 * Respects user's volume preference from D.4.3 (existing useDesktopApp).
 */

type Volume = 'mute' | 'low' | 'normal';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function volumeMultiplier(vol: Volume): number {
  switch (vol) {
    case 'mute': return 0;
    case 'low': return 0.15;
    case 'normal': return 0.35;
    default: return 0.35;
  }
}

/**
 * D.4.1 — Task complete chime.
 * Two-note ascending major third, sine wave with gentle decay.
 */
export function playTaskComplete(volume: Volume = 'normal'): void {
  const mul = volumeMultiplier(volume);
  if (mul === 0) return;

  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Note 1: C5 (523 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(mul, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Note 2: E5 (659 Hz) — starts 0.12s later
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(mul, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch {
    // Audio context may not be available
  }
}

/**
 * D.4.2 — Error alert.
 * Short descending minor second, triangle wave.
 */
export function playError(volume: Volume = 'normal'): void {
  const mul = volumeMultiplier(volume);
  if (mul === 0) return;

  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(380, now + 0.15);
    gain.gain.setValueAtTime(mul * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Audio context may not be available
  }
}

/**
 * Notification ping — single gentle tap for incoming messages/approvals.
 */
export function playNotification(volume: Volume = 'normal'): void {
  const mul = volumeMultiplier(volume);
  if (mul === 0) return;

  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(mul * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // Audio context may not be available
  }
}
