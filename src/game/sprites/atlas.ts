import { PALETTE, resolveSprite, SPRITES } from './data';

/** Rasteriza los sprites de data.ts a un único lienzo (atlas) para dibujarlos por lotes. */

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  canvas: HTMLCanvasElement;
  frames: Map<string, Frame>;
}

const SIZE = 512;
/** Sufijo de la silueta blanca de un sprite (destello al recibir un golpe). */
export const WHITE = '!';
/** Radio, en píxeles del atlas, de los círculos `ring` y `disc` (se escalan al dibujarlos). */
export const CIRCLE_RADIUS = 32;

function drawRows(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, white: boolean) {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = white ? '#ffffff' : PALETTE[ch];
      ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}

/** Círculo de píxeles sin suavizado: relleno (`disc`) o solo el borde (`ring`). */
function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, filled: boolean) {
  const r = CIRCLE_RADIUS;
  ctx.fillStyle = '#ffffff';
  for (let py = -r; py < r; py++) {
    for (let px = -r; px < r; px++) {
      const d = Math.hypot(px + 0.5, py + 0.5);
      if (d <= r && (filled || d > r - 2)) ctx.fillRect(x + r + px, y + r + py, 1, 1);
    }
  }
}

export function buildAtlas(): Atlas {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const frames = new Map<string, Frame>();

  // Empaquetado por estantes, con 1 px de separación para que los sprites no se contaminen al escalar.
  let x = 1;
  let y = 1;
  let shelf = 0;
  const place = (name: string, w: number, h: number): Frame => {
    if (x + w + 1 > SIZE) {
      x = 1;
      y += shelf + 1;
      shelf = 0;
    }
    if (y + h + 1 > SIZE) throw new Error('El atlas de sprites se ha quedado pequeño.');
    const frame = { x, y, w, h };
    frames.set(name, frame);
    x += w + 1;
    shelf = Math.max(shelf, h);
    return frame;
  };

  for (const [name, rows] of Object.entries(SPRITES)) {
    for (const white of [false, true]) {
      const frame = place(white ? name + WHITE : name, rows[0].length, rows.length);
      drawRows(ctx, rows, frame.x, frame.y, white);
    }
  }
  const px = place('px', 2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px.x, px.y, 2, 2);
  for (const [name, filled] of [['ring', false], ['disc', true]] as const) {
    const frame = place(name, CIRCLE_RADIUS * 2, CIRCLE_RADIUS * 2);
    drawCircle(ctx, frame.x, frame.y, filled);
  }
  return { canvas, frames };
}

/** Baldosa de suelo repetible: color base con motas deterministas de dos tonos. */
export function buildGroundTile(base: string, light: string, dark: string): HTMLCanvasElement {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  let seed = 12345;
  const next = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = next() < 0.5 ? light : dark;
    const x = Math.floor(next() * size);
    const y = Math.floor(next() * size);
    ctx.fillRect(x, y, next() < 0.3 ? 2 : 1, 1);
  }
  return canvas;
}

const urlCache = new Map<string, string>();

/** Imagen de un sprite para la interfaz HTML (iconos de armas, objetos…). */
export function spriteDataUrl(name: string): string {
  const key = resolveSprite(name);
  const cached = urlCache.get(key);
  if (cached) return cached;
  const rows = SPRITES[key];
  if (!rows) return '';
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  drawRows(canvas.getContext('2d')!, rows, 0, 0, false);
  const url = canvas.toDataURL();
  urlCache.set(key, url);
  return url;
}
