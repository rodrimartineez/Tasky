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

/** Velo de color sobre toda la escena (niebla, penumbra…): da el ambiente propio del escenario. */
export interface Tint {
  color: number;
  alpha: number;
}

/** Suelo de cada escenario (`StageDef.ground`): dibujo de la baldosa, fondo, velo, densidad de decoración y partículas. */
export const GROUNDS: Record<string, GroundStyle & { background: number; ambient: Ambient; tint: Tint; density: number }> = {
  // Bosque: hierba esmeralda y luz cálida, con hojas y polen a la deriva.
  t_grass: {
    base: '#1f3d28',
    light: '#2c5636',
    dark: '#15291b',
    accent: '#e0c24f',
    pattern: 'grass',
    background: 0x12201a,
    ambient: { colors: [0x9fd45a, 0xe0c24f], vx: 6, vy: 9, sway: 10, alpha: 0.55 },
    tint: { color: 0xffe9a0, alpha: 0.03 },
    density: 0.42,
  },
  // Pantano: barro pardo con charcas turbias, niebla verdosa y luciérnagas.
  t_bog: {
    base: '#2b2a1b',
    light: '#3b3a25',
    dark: '#1a190f',
    accent: '#5fb59a',
    extra: '#1e4a47',
    pattern: 'bog',
    background: 0x15150c,
    ambient: { colors: [0xd7ff8a, 0x9affc8], vx: 0, vy: -2, sway: 8, alpha: 0.8, twinkle: true },
    tint: { color: 0x2f7a4a, alpha: 0.13 },
    density: 0.4,
  },
  // Cripta: grandes losas violáceas con círculos rúnicos, polvo frío y penumbra.
  t_crypt: {
    base: '#2c2836',
    light: '#363043',
    dark: '#13101a',
    accent: '#4f6e3f',
    extra: '#7d4fc4',
    pattern: 'slabs',
    background: 0x100d16,
    ambient: { colors: [0xc9c0dc, 0x8f78c8], vx: -3, vy: -2, sway: 3, alpha: 0.32 },
    tint: { color: 0x2a1450, alpha: 0.16 },
    density: 0.36,
  },
  // Cavernas: roca azul marino atravesada por venas de cristal luminoso.
  t_cave: {
    base: '#141a30',
    light: '#1e2748',
    dark: '#0a0e1d',
    accent: '#4fd0ff',
    extra: '#9a6bff',
    pattern: 'rocks',
    background: 0x090c18,
    ambient: { colors: [0x8fe0ff, 0xc9a8ff], vx: 0, vy: 0, sway: 2, alpha: 0.85, twinkle: true },
    tint: { color: 0x1a3ec8, alpha: 0.12 },
    density: 0.34,
  },
  // Páramo: costra volcánica casi negra con ríos de lava y ascuas que suben.
  t_ash: {
    base: '#1f1511',
    light: '#2d1f19',
    dark: '#0f0907',
    accent: '#ff6a1f',
    extra: '#ffd25e',
    pattern: 'ash',
    background: 0x0b0605,
    ambient: { colors: [0xff8a3c, 0xffc35e, 0x8a7d78], vx: 4, vy: -18, sway: 6, alpha: 0.85, twinkle: true },
    tint: { color: 0x8a2200, alpha: 0.12 },
    density: 0.36,
  },
};
