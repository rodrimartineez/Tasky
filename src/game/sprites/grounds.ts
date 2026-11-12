import type { GroundStyle } from './atlas';

/** Partículas de ambiente del escenario (hojas, luciérnagas, polvo, destellos, brasas). */
export interface Ambient {
  colors: number[];
  vx: number;
  vy: number;
  /** Amplitud del vaivén lateral. */
  sway: number;
  alpha: number;
  /** Parpadeo (luces) en vez de brillo fijo. */
  twinkle?: boolean;
}

/** Suelo de cada escenario (`StageDef.ground`): dibujo de la baldosa, fondo y partículas de ambiente. */
export const GROUNDS: Record<string, GroundStyle & { background: number; ambient: Ambient }> = {
  t_grass: {
    base: '#1b2f24',
    light: '#26442f',
    dark: '#14231a',
    accent: '#c9a74a',
    pattern: 'grass',
    background: 0x12201a,
    ambient: { colors: [0x8fbf5a, 0xc9a74a], vx: 6, vy: 9, sway: 10, alpha: 0.55 },
  },
  t_bog: {
    base: '#1c2a2b',
    light: '#2b403c',
    dark: '#111b1d',
    accent: '#6f9a4a',
    pattern: 'bog',
    background: 0x101a1b,
    ambient: { colors: [0xd7ff8a], vx: 0, vy: -2, sway: 8, alpha: 0.75, twinkle: true },
  },
  t_crypt: {
    base: '#2a2630',
    light: '#3a3444',
    dark: '#18151e',
    accent: '#4c5a3c',
    pattern: 'slabs',
    background: 0x16131c,
    ambient: { colors: [0xb8b0c8], vx: -3, vy: -2, sway: 3, alpha: 0.3 },
  },
  t_cave: {
    base: '#1f2338',
    light: '#2e3452',
    dark: '#141729',
    accent: '#5fb7e8',
    pattern: 'rocks',
    background: 0x111424,
    ambient: { colors: [0x8fd8ff, 0xd0b8ff], vx: 0, vy: 0, sway: 2, alpha: 0.8, twinkle: true },
  },
  t_ash: {
    base: '#32231e',
    light: '#3b2b23',
    dark: '#1f1512',
    accent: '#ff7a2e',
    pattern: 'ash',
    background: 0x1c130f,
    ambient: { colors: [0xff8a3c, 0xffc35e], vx: 2, vy: -16, sway: 6, alpha: 0.8, twinkle: true },
  },
};
