import { audio } from './engine';

/**
 * Efectos de sonido sintetizados. Cada uno tiene un intervalo mínimo entre repeticiones: con cientos de golpes
 * por segundo, solo suenan unos pocos (y el motor limita además las voces simultáneas).
 */
export type Sfx =
  | 'hit'
  | 'zap'
  | 'boom'
  | 'kill'
  | 'xp'
  | 'coin'
  | 'hurt'
  | 'levelUp'
  | 'select'
  | 'chestShake'
  | 'chestOpen'
  | 'reward'
  | 'evolution'
  | 'gold'
  | 'boss'
  | 'wave'
  | 'reaper'
  | 'defeat'
  | 'victory'
  | 'purge';

const GAP: Partial<Record<Sfx, number>> = { hit: 0.045, zap: 0.06, boom: 0.09, kill: 0.035, xp: 0.03, coin: 0.06, hurt: 0.18 };
const last = new Map<Sfx, number>();

/** Familia de elemento → tono del golpe (content/weapons.ts, hitFxOf). */
const HIT_PITCH: Record<string, number> = { fire: 180, lightning: 900, arcane: 520, poison: 260, steel: 700 };

/** Racha de recogidas de experiencia: cada gema seguida suena un poco más aguda (se reinicia al parar). */
let xpChain = 0;
let xpChainAt = 0;

const rnd = (spread: number) => 1 + (Math.random() * 2 - 1) * spread;
const note = (semitones: number, base = 440) => base * Math.pow(2, semitones / 12);

/** Toca un efecto. `detail`: familia del golpe para `hit`. */
export function play(name: Sfx, detail?: string) {
  if (!audio.context() || !audio.canPlay()) return;
  const now = audio.now;
  const gap = GAP[name];
  if (gap !== undefined) {
    if (now - (last.get(name) ?? -1) < gap) return;
    last.set(name, now);
  }
  switch (name) {
    case 'hit': {
      const f = (HIT_PITCH[detail ?? ''] ?? 500) * rnd(0.08);
      audio.noise({ dur: 0.05, vol: 0.12, filter: 'bandpass', freq: f * 3, to: f });
      audio.tone({ type: 'square', freq: f, to: f * 0.6, dur: 0.05, vol: 0.04, lowpass: 2400 });
      break;
    }
    case 'zap':
      audio.tone({ type: 'sawtooth', freq: 1400 * rnd(0.1), to: 300, dur: 0.09, vol: 0.05, lowpass: 3000 });
      break;
    case 'boom':
      audio.noise({ dur: 0.35, vol: 0.28, filter: 'lowpass', freq: 1400, to: 90 });
      audio.tone({ type: 'sine', freq: 110, to: 40, dur: 0.3, vol: 0.22 });
      break;
    case 'kill':
      audio.tone({ type: 'square', freq: 320 * rnd(0.15), to: 90, dur: 0.07, vol: 0.05, lowpass: 1800 });
      break;
    case 'xp': {
      xpChain = now - xpChainAt < 0.35 ? Math.min(xpChain + 1, 14) : 0;
      xpChainAt = now;
      audio.tone({ type: 'triangle', freq: note(xpChain, 880), dur: 0.08, vol: 0.07 });
      break;
    }
    case 'coin':
      audio.tone({ type: 'square', freq: 1320, dur: 0.05, vol: 0.04, lowpass: 5000 });
      audio.tone({ type: 'square', freq: 1760, dur: 0.12, vol: 0.04, delay: 0.05, lowpass: 5000 });
      break;
    case 'hurt':
      audio.tone({ type: 'sawtooth', freq: 160, to: 60, dur: 0.16, vol: 0.12, lowpass: 900 });
      audio.noise({ dur: 0.1, vol: 0.1, filter: 'lowpass', freq: 800 });
      break;
    case 'levelUp':
      [0, 4, 7, 12, 16].forEach((s, i) => audio.tone({ type: 'square', freq: note(s, 523.25), dur: 0.14, vol: 0.06, delay: i * 0.06, lowpass: 4000 }));
      break;
    case 'select':
      audio.tone({ type: 'square', freq: 660, to: 990, dur: 0.08, vol: 0.06, lowpass: 4000 });
      break;
    case 'chestShake':
      for (let i = 0; i < 6; i++) audio.noise({ dur: 0.05, vol: 0.12, filter: 'bandpass', freq: 900 + (i % 2) * 400, delay: 0.15 + i * 0.11 });
      audio.tone({ type: 'triangle', freq: 220, to: 660, dur: 0.85, vol: 0.05 });
      break;
    case 'chestOpen':
      audio.noise({ dur: 0.6, vol: 0.18, filter: 'highpass', freq: 3000, to: 8000 });
      [0, 7, 12, 16, 19, 24].forEach((s, i) => audio.tone({ type: 'triangle', freq: note(s, 523.25), dur: 0.5, vol: 0.06, delay: i * 0.05 }));
      break;
    case 'reward':
      audio.tone({ type: 'square', freq: 784, dur: 0.07, vol: 0.06, lowpass: 5000 });
      audio.tone({ type: 'square', freq: 1175, dur: 0.16, vol: 0.06, delay: 0.07, lowpass: 5000 });
      break;
    case 'evolution':
      [0, 4, 7, 11, 14, 19, 24].forEach((s, i) => audio.tone({ type: 'sawtooth', freq: note(s, 392), dur: 0.7, vol: 0.04, delay: i * 0.07, lowpass: 3500 }));
      audio.noise({ dur: 1, vol: 0.08, filter: 'highpass', freq: 5000 });
      break;
    case 'gold':
      for (let i = 0; i < 6; i++) audio.tone({ type: 'square', freq: 1320 + (i % 3) * 220, dur: 0.06, vol: 0.035, delay: i * 0.06, lowpass: 5000 });
      break;
    case 'boss':
      audio.tone({ type: 'sawtooth', freq: 55, dur: 1.4, vol: 0.14, attack: 0.08, lowpass: 600 });
      audio.tone({ type: 'sawtooth', freq: 82.4, dur: 1.4, vol: 0.1, attack: 0.08, delay: 0.25, lowpass: 600 });
      audio.noise({ dur: 0.6, vol: 0.12, filter: 'lowpass', freq: 400 });
      break;
    case 'wave':
      for (let i = 0; i < 3; i++) audio.tone({ type: 'square', freq: 880, to: 660, dur: 0.16, vol: 0.05, delay: i * 0.22, lowpass: 3000 });
      break;
    case 'reaper':
      [0, 0.9, 1.8].forEach((d) => audio.tone({ type: 'sine', freq: 98, to: 92, dur: 1.6, vol: 0.18, delay: d, attack: 0.01 }));
      audio.tone({ type: 'triangle', freq: 49, dur: 3.2, vol: 0.12, attack: 0.3 });
      break;
    case 'defeat':
      [0, -3, -7, -12].forEach((s, i) => audio.tone({ type: 'triangle', freq: note(s, 392), dur: 0.45, vol: 0.08, delay: i * 0.22 }));
      break;
    case 'victory':
      [0, 4, 7, 12].forEach((s, i) => audio.tone({ type: 'square', freq: note(s, 523.25), dur: 0.3, vol: 0.06, delay: i * 0.12, lowpass: 4000 }));
      [0, 4, 7].forEach((s) => audio.tone({ type: 'triangle', freq: note(s + 12, 523.25), dur: 1.2, vol: 0.05, delay: 0.5 }));
      break;
    case 'purge':
      audio.tone({ type: 'sawtooth', freq: 600, to: 80, dur: 0.6, vol: 0.08, lowpass: 2000 });
      audio.noise({ dur: 0.5, vol: 0.1, filter: 'bandpass', freq: 1200, to: 200 });
      break;
  }
}
