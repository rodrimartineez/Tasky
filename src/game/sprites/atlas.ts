import { PALETTE, SPRITES } from './data';

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
  for (const [name, filled] of [
    ['ring', false],
    ['disc', true],
  ] as const) {
    const frame = place(name, CIRCLE_RADIUS * 2, CIRCLE_RADIUS * 2);
    drawCircle(ctx, frame.x, frame.y, filled);
  }
  return { canvas, frames };
}

/** Baldosa de suelo repetible: color base con motas deterministas de dos tonos. */
export interface GroundStyle {
  base: string;
  light: string;
  dark: string;
  /** Detalle de color (flores, musgo, brasas…). */
  accent: string;
  pattern: 'grass' | 'bog' | 'slabs' | 'rocks' | 'ash';
}

/** Baldosa repetible del suelo de un escenario (96×96, sin costuras: todo se dibuja con módulo). */
export function buildGroundTile(g: GroundStyle): HTMLCanvasElement {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = g.base;
  ctx.fillRect(0, 0, size, size);
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const int = (n: number) => Math.floor(rnd() * n);
  const px = (x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(((x % size) + size) % size, ((y % size) + size) % size, 1, 1);
  };
  // Mancha irregular (bordes deshilachados).
  const patch = (cx: number, cy: number, r: number, c: string) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r * (0.6 + rnd() * 0.5)) px(cx + x, cy + y, c);
  };
  const motes = (n: number) => {
    for (let i = 0; i < n; i++) px(int(size), int(size), rnd() < 0.5 ? g.light : g.dark);
  };

  if (g.pattern === 'grass' || g.pattern === 'bog') {
    for (let i = 0; i < 7; i++) patch(int(size), int(size), 6 + int(8), rnd() < 0.5 ? g.light : g.dark);
    if (g.pattern === 'bog') {
      // Charcos oscuros con un brillo arriba.
      for (let i = 0; i < 4; i++) {
        const x = int(size);
        const y = int(size);
        const r = 3 + int(4);
        patch(x, y, r, g.dark);
        for (let k = -r + 2; k < r - 1; k++) px(x + k, y - r + 1, g.light);
      }
    }
    // Matas de hierba: dos briznas claras sobre una base oscura.
    for (let i = 0; i < 46; i++) {
      const x = int(size);
      const y = int(size);
      px(x, y + 1, g.dark);
      px(x + 1, y + 1, g.dark);
      px(x - 1, y, g.light);
      px(x + 1, y - 1, g.light);
      if (rnd() < 0.4) px(x + 2, y, g.light);
    }
    for (let i = 0; i < 6; i++) px(int(size), int(size), g.accent);
    motes(50);
  } else if (g.pattern === 'slabs') {
    // Losas de 24×16 en hileras alternas: junta oscura, canto claro arriba a la izquierda y grietas.
    for (let row = 0; row < size / 16; row++) {
      const shift = row % 2 ? 12 : 0;
      for (let col = 0; col < size / 24; col++) {
        const x0 = col * 24 + shift;
        const y0 = row * 16;
        for (let k = 0; k < 24; k++) {
          px(x0 + k, y0, g.dark);
          px(x0 + k, y0 + 1, g.light);
        }
        for (let k = 0; k < 16; k++) {
          px(x0, y0 + k, g.dark);
          px(x0 + 1, y0 + k, g.light);
        }
        if (rnd() < 0.35) patch(x0 + 6 + int(12), y0 + 5 + int(6), 3, g.light);
        if (rnd() < 0.4) {
          let cx = x0 + 4 + int(16);
          let cy = y0 + 3;
          for (let k = 0; k < 9; k++) {
            px(cx, cy, g.dark);
            cy++;
            cx += int(3) - 1;
          }
        }
      }
    }
    for (let i = 0; i < 5; i++) patch(int(size), int(size), 2, g.accent);
    motes(30);
  } else if (g.pattern === 'rocks') {
    for (let i = 0; i < 5; i++) patch(int(size), int(size), 8 + int(6), g.dark);
    // Piedras: cuerpo claro y sombra abajo a la derecha.
    for (let i = 0; i < 22; i++) {
      const x = int(size);
      const y = int(size);
      const w = 3 + int(5);
      const h = 2 + int(3);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(x + xx, y + yy, g.light);
      for (let xx = 1; xx <= w; xx++) px(x + xx, y + h, g.dark);
      for (let yy = 1; yy <= h; yy++) px(x + w, y + yy, g.dark);
    }
    for (let i = 0; i < 9; i++) px(int(size), int(size), g.accent);
    motes(40);
  } else {
    for (let i = 0; i < 6; i++) patch(int(size), int(size), 7 + int(8), rnd() < 0.5 ? g.light : g.dark);
    // Grietas con brasas.
    for (let i = 0; i < 7; i++) {
      let x = int(size);
      let y = int(size);
      const dx = rnd() < 0.5 ? 1 : -1;
      for (let k = 0; k < 14; k++) {
        px(x, y, rnd() < 0.25 ? g.accent : g.dark);
        x += dx;
        y += int(3) - 1;
      }
    }
    motes(50);
  }
  return canvas;
}

const urlCache = new Map<string, string>();

/** Imagen de un sprite para la interfaz HTML (iconos de armas, objetos…). */
export function spriteDataUrl(name: string): string {
  const cached = urlCache.get(name);
  if (cached) return cached;
  const rows = SPRITES[name];
  if (!rows) return '';
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  drawRows(canvas.getContext('2d')!, rows, 0, 0, false);
  const url = canvas.toDataURL();
  urlCache.set(name, url);
  return url;
}
