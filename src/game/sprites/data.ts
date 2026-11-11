import { ART } from './art';
/**
 * Pixel art original del juego, definido como texto: cada carácter es un píxel de la paleta ('.' = transparente).
 * Se rasteriza a un atlas al arrancar el juego (atlas.ts). Versionable, sin archivos de imagen ni recursos de terceros.
 */

export const PALETTE: Record<string, string> = {
  k: '#0b0a14', // contorno
  w: '#ffffff',
  W: '#d8d4e8',
  s: '#8d89a6',
  S: '#5a5670',
  r: '#e5484d',
  R: '#9b2335',
  o: '#ff9f3a',
  O: '#c4621c',
  y: '#f6c945',
  Y: '#c9901f',
  g: '#5ee08a',
  G: '#2c9a56',
  d: '#1d6b3f',
  b: '#6bc5ff',
  B: '#2f6fd6',
  p: '#b58cff',
  P: '#6a44c9',
  t: '#e0a878',
  T: '#8a5a34',
  D: '#54351f',
  c: '#7ee8e0',
  m: '#ff7ac3',
  M: '#b84a8c',
  // Ampliación de la Fase 7 (ARTE_GUIA.md): más tonos para sombrear como en los personajes.
  n: '#1f1b33', // sombra profunda
  e: '#3a2f5c', // sombra violeta
  a: '#ffd9b8', // piel clara
  f: '#b06a3c', // piel oscura / cuero
  h: '#ffe9a8', // brillo cálido
  l: '#a8f06a', // lima
  v: '#4a8f2f', // musgo
  q: '#3f2a1a', // madera oscura
  u: '#9ad8ff', // hielo
  z: '#1c3f8f', // azul profundo
  x: '#ff4f9a', // rosa intenso
  A: '#7a1a24', // sangre oscura
  C: '#3a8f8a', // verde azulado
  E: '#e8d9b0', // hueso
  F: '#ff6a2a', // llama
  L: '#f0f0ff', // blanco frío
};

/** Todos los sprites: el arte de `art/` (guía en ARTE_GUIA.md) y las cifras de daño. */
export const SPRITES: Record<string, string[]> = {
  ...ART,

  // ── Cifras de los indicadores de daño (3×5) ──
  n0: ['www', 'w.w', 'w.w', 'w.w', 'www'],
  n1: ['.w.', 'ww.', '.w.', '.w.', 'www'],
  n2: ['www', '..w', 'www', 'w..', 'www'],
  n3: ['www', '..w', '.ww', '..w', 'www'],
  n4: ['w.w', 'w.w', 'www', '..w', '..w'],
  n5: ['www', 'w..', 'www', '..w', 'www'],
  n6: ['www', 'w..', 'www', 'w.w', 'www'],
  n7: ['www', '..w', '.w.', '.w.', '.w.'],
  n8: ['www', 'w.w', 'www', 'w.w', 'www'],
  n9: ['www', 'w.w', 'www', '..w', 'www'],
};
