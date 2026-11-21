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
/** Sprites con luz de borde: personajes, enemigos, jefes, y los iconos de armas y pasivas. */
const LIT = /^(c_|hero_|e_|b_|w_|p_|a_)/;

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (c: string, to: number, amount: number) =>
  `rgb(${hex(c)
    .map((v) => Math.round(v + (to - v) * amount))
    .join(',')})`;

/**
 * Dibuja un sprite. Con `lit`, añade una luz de borde: los píxeles que tocan el contorno por arriba se aclaran y los
 * que lo tocan por abajo o por la derecha se oscurecen, lo que da volumen a todo el arte sin redibujarlo.
 */
export function drawRows(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, white: boolean, lit = false) {
  const edge = (r: number, c: number) => {
    const ch = rows[r]?.[c];
    return ch === undefined || ch === '.' || ch === 'k';
  };
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      let color = white ? '#ffffff' : PALETTE[ch];
      if (lit && !white && ch !== 'k') {
        if (edge(r - 1, c) && !edge(r + 1, c)) color = mix(color, 255, 0.22);
        else if (edge(r + 1, c) && !edge(r - 1, c)) color = mix(color, 0, 0.22);
        else if (edge(r, c + 1) && !edge(r, c - 1)) color = mix(color, 0, 0.12);
      }
      ctx.fillStyle = color;
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
      drawRows(ctx, rows, frame.x, frame.y, white, LIT.test(name));
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
  /** Segundo color de detalle (agua, runas, gemas, núcleo de la lava). */
  extra?: string;
  pattern: 'grass' | 'bog' | 'slabs' | 'rocks' | 'ash';
}

/** Baldosa repetible del suelo de un escenario (96×96, sin costuras: todo se dibuja con módulo). */
export function buildGroundTile(g: GroundStyle): HTMLCanvasElement {
  const size = 192;
  // Cuatro veces el área de la baldosa original: todos los conteos se multiplican para mantener la densidad.
  const A = 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = g.base;
  ctx.fillRect(0, 0, size, size);
  let seed = 12345;
  // mulberry32: sin las alineaciones que dejaba un congruencial simple.
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

  // Línea quebrada que serpentea (grietas, venas, ríos de lava): `put` pinta cada punto.
  const wander = (x: number, y: number, len: number, dx: number, dy: number, put: (x: number, y: number, k: number) => void) => {
    for (let k = 0; k < len; k++) {
      put(x, y, k);
      if (dx !== 0) x += rnd() < 0.85 ? dx : 0;
      if (dy !== 0) y += rnd() < 0.85 ? dy : 0;
      else y += int(3) - 1;
      if (dx === 0) x += int(3) - 1;
    }
  };

  if (g.pattern === 'grass') {
    for (let i = 0; i < 7 * A; i++) patch(int(size), int(size), 6 + int(8), rnd() < 0.5 ? g.light : g.dark);
    // Matas de hierba: dos briznas claras sobre una base oscura.
    for (let i = 0; i < 46 * A; i++) {
      const x = int(size);
      const y = int(size);
      px(x, y + 1, g.dark);
      px(x + 1, y + 1, g.dark);
      px(x - 1, y, g.light);
      px(x + 1, y - 1, g.light);
      if (rnd() < 0.4) px(x + 2, y, g.light);
    }
    for (let i = 0; i < 6 * A; i++) px(int(size), int(size), g.accent);
    motes(50 * A);
  } else if (g.pattern === 'bog') {
    // Barro con grandes charcas de agua turbia: orilla oscura, reflejo claro y ondas.
    const water = g.extra ?? g.dark;
    for (let i = 0; i < 9 * A; i++) patch(int(size), int(size), 5 + int(7), rnd() < 0.5 ? g.light : g.dark);
    for (let i = 0; i < 5 * A; i++) {
      const cx = int(size);
      const cy = int(size);
      const rx = 9 + int(8);
      const ry = 5 + int(4);
      for (let y = -ry - 1; y <= ry + 1; y++) {
        for (let x = -rx - 1; x <= rx + 1; x++) {
          const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          if (d <= 1) px(cx + x, cy + y, water);
          else if (d <= 1.35) px(cx + x, cy + y, g.dark);
        }
      }
      for (let k = -rx + 4; k < rx - 6; k++) px(cx + k, cy - ry + 2, g.accent);
      for (let k = 0; k < 6; k++) px(cx - 3 + k, cy + 1, g.light);
    }
    // Juncos bajos y burbujas.
    for (let i = 0; i < 34 * A; i++) {
      const x = int(size);
      const y = int(size);
      px(x, y, g.accent);
      px(x, y - 1, g.accent);
      px(x + 1, y - 2, g.light);
      px(x - 1, y + 1, g.dark);
    }
    motes(40 * A);
  } else if (g.pattern === 'slabs') {
    // Losas grandes de 32×32 en damero, con bisel, grietas, musgo y un círculo rúnico en el centro.
    const slab = 32;
    for (let row = 0; row < size / slab; row++) {
      for (let col = 0; col < size / slab; col++) {
        const x0 = col * slab;
        const y0 = row * slab;
        ctx.fillStyle = (row + col) % 2 ? g.light : g.base;
        ctx.fillRect(x0, y0, slab, slab);
        for (let k = 0; k < slab; k++) {
          px(x0 + k, y0 + slab - 1, g.dark);
          px(x0 + slab - 1, y0 + k, g.dark);
          px(x0 + k, y0, g.light);
          px(x0, y0 + k, g.light);
        }
        for (let k = 1; k < slab - 1; k++) {
          px(x0 + k, y0 + slab - 2, g.dark);
          px(x0 + slab - 2, y0 + k, g.dark);
        }
        if (rnd() < 0.7) wander(x0 + 6 + int(18), y0 + 3, 12 + int(10), 0, 1, (x, y) => px(x, y, g.dark));
        if (rnd() < 0.5) patch(x0 + 3 + int(4), y0 + 3 + int(4), 3, g.accent);
        if (rnd() < 0.4) patch(x0 + slab - 6, y0 + slab - 6, 2, g.accent);
      }
    }
    const rune = g.extra ?? g.accent;
    for (const [cx, cy] of [
      [48, 48],
      [144, 144],
    ]) {
      for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        px(Math.round(cx + Math.cos(t) * 11), Math.round(cy + Math.sin(t) * 11), rune);
        if (a % 2 === 0) px(Math.round(cx + Math.cos(t) * 7), Math.round(cy + Math.sin(t) * 7), g.dark);
      }
      for (let k = -5; k <= 5; k++) {
        px(cx + k, cy, rune);
        px(cx, cy + k, rune);
      }
    }
    motes(26 * A);
  } else if (g.pattern === 'rocks') {
    // Suelo de cueva: placas de roca irregulares y venas de cristal que brillan.
    for (let i = 0; i < 14 * A; i++) patch(int(size), int(size), 6 + int(8), rnd() < 0.55 ? g.light : g.dark);
    for (let i = 0; i < 26 * A; i++) {
      const x = int(size);
      const y = int(size);
      const w = 3 + int(5);
      const h = 2 + int(3);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(x + xx, y + yy, g.light);
      for (let xx = 1; xx <= w; xx++) px(x + xx, y + h, g.dark);
      for (let yy = 1; yy <= h; yy++) px(x + w, y + yy, g.dark);
    }
    for (let i = 0; i < 5 * A; i++) {
      wander(int(size), int(size), 22 + int(14), rnd() < 0.5 ? 1 : -1, rnd() < 0.5 ? 1 : 0, (x, y, k) => {
        px(x, y + 1, g.dark);
        px(x, y, k % 5 === 0 ? (g.extra ?? g.accent) : g.accent);
      });
    }
    for (let i = 0; i < 10 * A; i++) {
      const x = int(size);
      const y = int(size);
      const c = rnd() < 0.5 ? g.accent : (g.extra ?? g.accent);
      px(x, y, c);
      px(x - 1, y, g.light);
      px(x + 1, y, g.light);
      px(x, y - 1, g.light);
      px(x, y + 1, g.light);
    }
    motes(40 * A);
  } else {
    // Páramo volcánico: costra oscura cuarteada, ríos de lava incandescente, brasas y ceniza.
    for (let i = 0; i < 9 * A; i++) patch(int(size), int(size), 6 + int(8), rnd() < 0.5 ? g.light : g.dark);
    for (let i = 0; i < 5 * A; i++) {
      wander(int(size), int(size), 34 + int(18), rnd() < 0.5 ? 1 : -1, rnd() < 0.5 ? 1 : 0, (x, y, k) => {
        px(x, y - 1, g.dark);
        px(x, y + 1, g.dark);
        px(x, y, k % 3 === 0 ? (g.extra ?? g.accent) : g.accent);
        if (k % 4 === 0) px(x + 1, y, g.accent);
      });
    }
    for (let i = 0; i < 3 * A; i++) {
      const x = int(size);
      const y = int(size);
      patch(x, y, 5, g.dark);
      patch(x, y, 3, g.accent);
      px(x, y, g.extra ?? g.accent);
      px(x - 1, y, g.extra ?? g.accent);
    }
    for (let i = 0; i < 70 * A; i++) px(int(size), int(size), rnd() < 0.8 ? g.light : g.dark);
    for (let i = 0; i < 12 * A; i++) px(int(size), int(size), g.accent);
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
  drawRows(canvas.getContext('2d')!, rows, 0, 0, false, LIT.test(name));
  const url = canvas.toDataURL();
  urlCache.set(name, url);
  return url;
}
