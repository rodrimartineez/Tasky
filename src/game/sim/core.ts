import { ENEMY_BY_ID } from '../content/enemies';
import { runDamage, runDensity, runGold, runHp } from './difficulty';
import type { Enemy, EnemyDef, Fx, PickupKind, World } from './types';

/** Utilidades compartidas por los sistemas de la simulación: azar, consulta espacial, daño y botín. */

/** Generador determinista (mulberry32): la misma semilla produce la misma partida. */
export function rand(w: World): number {
  w.rngState = (w.rngState + 0x6d2b79f5) | 0;
  let t = w.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const FX_LIMIT = 300;
/** Los efectos son solo visuales: si nadie los consume (sin pantalla) o hay demasiados, se descartan. */
export function emit(w: World, fx: Fx) {
  if (w.fx.length < FX_LIMIT) w.fx.push(fx);
}

// ── Rejilla espacial ────────────────────────────────────────────────────────────────────────────
// Tabla hash de celdas de 32 px reconstruida en cada paso. Es estado derivado: no forma parte del mundo.
const CELL = 32;
const BUCKETS = 1024;
const buckets: Enemy[][] = Array.from({ length: BUCKETS }, () => []);
const bucketOf = (cx: number, cy: number) => ((cx * 73856093) ^ (cy * 19349663)) & (BUCKETS - 1);
let stamp = 0;

export function rebuildGrid(w: World) {
  for (const b of buckets) b.length = 0;
  for (const e of w.enemies) {
    if (!e.dead) buckets[bucketOf(Math.floor(e.x / CELL), Math.floor(e.y / CELL))].push(e);
  }
}

/** Resultado de la última consulta (se reutiliza: copiar si se necesita conservar). */
export const near: Enemy[] = [];

/** Enemigos vivos cuyo círculo toca el círculo (x, y, r). Devuelve cuántos hay en `near`. */
export function queryNear(x: number, y: number, r: number): number {
  near.length = 0;
  stamp += 1;
  // Margen por el radio del enemigo más grande (jefe).
  const reach = r + 20;
  const x0 = Math.floor((x - reach) / CELL);
  const x1 = Math.floor((x + reach) / CELL);
  const y0 = Math.floor((y - reach) / CELL);
  const y1 = Math.floor((y + reach) / CELL);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const bucket = buckets[bucketOf(cx, cy)];
      for (let i = 0; i < bucket.length; i++) {
        const e = bucket[i];
        if (e.dead || e.stamp === stamp) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        const rr = r + e.radius;
        if (dx * dx + dy * dy <= rr * rr) {
          e.stamp = stamp;
          near.push(e);
        }
      }
    }
  }
  return near.length;
}

/** Enemigo vivo más cercano a un punto dentro de `range` (recorre todos: se usa pocas veces por segundo). */
export function nearestEnemy(w: World, x: number, y: number, range: number, skip?: number[]): Enemy | null {
  let best: Enemy | null = null;
  let bestD = range * range;
  for (const e of w.enemies) {
    if (e.dead || (skip && skip.includes(e.uid))) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

// ── Dificultad ──────────────────────────────────────────────────────────────────────────────────
// Depende del minuto de partida y del nivel (sim/difficulty.ts), nunca de las mejoras del jugador.
const minutes = (w: World) => w.time / 60;
/**
 * Escalada dentro de cada partida (se multiplica por la dureza del nivel, así cada nivel empieza más arriba y vuelve
 * a subir durante sus 30 minutos). Con los valores actuales, respecto al minuto 0:
 * - Vida: ×3,6 en el minuto 10, ×9 en el 20 y ×17 en el 30.
 * - Daño: ×1,7 / ×2,7 / ×4 (antes de la Fase 8 llegaba solo a ×2,65: quedarse quieto con una build fuerte salía gratis).
 * - Veteranos: desde el minuto 5, una parte creciente de las apariciones normales sale reforzada (hasta 1 de cada 6
 *   en el minuto 30), con más vida y daño.
 */
export const RAMP = {
  hp: [0.12, 0.014],
  damage: [0.055, 0.0015],
  /** Veteranos: minuto en que empiezan, fracción en el 30 y refuerzo (vida, daño, tamaño, experiencia). */
  champion: { from: 5, share: 1 / 6, hp: 3, damage: 1.3, radius: 1.2, xp: 3 },
};
const ramp = ([a, b]: number[], m: number) => 1 + a * m + b * m * m;
/** Multiplicador de vida por los minutos de partida (sin el del nivel). */
export const timeHpScale = (w: World) => ramp(RAMP.hp, minutes(w));
export const hpScale = (w: World) => timeHpScale(w) * runHp(w.config);
export const damageScale = (w: World) => ramp(RAMP.damage, minutes(w)) * runDamage(w.config);
/** Probabilidad de que una aparición normal sea un veterano. */
export const championChance = (w: World) =>
  Math.max(0, Math.min(1, (minutes(w) - RAMP.champion.from) / (30 - RAMP.champion.from))) * RAMP.champion.share;
/** Los enemigos aceleran poco a poco: al final ya no basta con huir. */
export const speedScale = (w: World) => 1 + minutes(w) * 0.01;
/** Máximo de enemigos vivos generados por aparición continua e invocaciones. */
/** Tope de enemigos en pantalla (más alto durante las oleadas; 450 como mucho por el rendimiento en móvil). */
export const maxEnemies = (w: World) => Math.min(450, (70 + minutes(w) * 16) * runDensity(w.config) * (inWave(w) ? WAVES.cap : 1));

/**
 * Oleadas: cada minuto tiene un tramo normal, una oleada (más apariciones y un anillo de enemigos alrededor) y un
 * respiro corto. Segundos dentro de cada minuto.
 */
export const WAVES = { from: 34, to: 50, surge: 2.6, lull: 0.45, cap: 1.3, ring: 14, ringPerMinute: 1.2 };
export const inWave = (w: World) => {
  const s = w.time % 60;
  return s >= WAVES.from && s < WAVES.to;
};
/** Ritmo de aparición según el momento del minuto. */
export const waveFactor = (w: World) => {
  const s = w.time % 60;
  return s < WAVES.from ? 1 : s < WAVES.to ? WAVES.surge : WAVES.lull;
};

// ── Enemigos ────────────────────────────────────────────────────────────────────────────────────
const SPAWN_RADIUS = 310;

export function spawnEnemy(w: World, def: EnemyDef, x: number, y: number, elite = false, champion = false): Enemy {
  const c = champion && !elite ? RAMP.champion : null;
  const hp = def.hp * hpScale(w) * (elite ? 6 : 1) * (c?.hp ?? 1);
  const e: Enemy = {
    uid: w.nextUid++,
    def,
    x,
    y,
    hp,
    maxHp: hp,
    damage: def.damage * damageScale(w) * (elite ? 1.5 : 1) * (c?.damage ?? 1),
    speed: def.speed * speedScale(w),
    radius: def.radius * (elite ? 1.5 : c?.radius ?? 1),
    elite,
    ...(c ? { champion: true } : {}),
    kx: 0,
    ky: 0,
    flash: 0,
    t1: 1 + rand(w) * 2,
    t2: 5,
    state: 0,
    vx: 0,
    vy: 0,
    contactCd: 0,
    stamp: 0,
    dead: false,
  };
  w.enemies.push(e);
  return e;
}

/** Punto justo fuera de la pantalla, alrededor del jugador. */
export function ringPoint(w: World, angle = rand(w) * Math.PI * 2, radius = SPAWN_RADIUS + rand(w) * 40) {
  return { x: w.player.x + Math.cos(angle) * radius, y: w.player.y + Math.sin(angle) * radius };
}

const MAX_PICKUPS = 500;

export function dropPickup(w: World, kind: PickupKind, x: number, y: number, value: number) {
  if (kind === 'xp' && w.pickups.length >= MAX_PICKUPS) {
    // Demasiadas gemas en el suelo: la experiencia se suma a una existente en vez de crear otra.
    const start = Math.floor(rand(w) * w.pickups.length);
    for (let i = 0; i < w.pickups.length; i++) {
      const p = w.pickups[(start + i) % w.pickups.length];
      if (p.kind === 'xp' && !p.dead) {
        p.value += value;
        return;
      }
    }
  }
  w.pickups.push({ kind, x, y, value, pulled: false, dead: false });
}

function killEnemy(w: World, e: Enemy) {
  e.dead = true;
  w.kills += 1;
  const luck = w.player.stats.luck;
  const boss = e.def.ai === 'boss';
  // En niveles con más densidad salen más enemigos: cada uno da menos experiencia para que el ritmo de subida sea parecido.
  dropPickup(w, 'xp', e.x, e.y, (e.def.xp * (e.elite ? 10 : e.champion ? RAMP.champion.xp : 1)) / runDensity(w.config));
  if (boss) {
    w.bossAlive = w.enemies.some((o) => !o.dead && o.def.ai === 'boss');
    if (e.def.patterns) w.cycleBoss = 2;
    dropPickup(w, 'chest', e.x + 10, e.y, 1);
    dropPickup(w, 'coin', e.x - 10, e.y, (e.def.patterns ? 300 : 60) * runGold(w.config));
    emit(w, { type: 'shake', power: 6 });
  } else if (e.elite) {
    dropPickup(w, 'chest', e.x, e.y + 6, 1);
  } else {
    const roll = rand(w);
    if (roll < 0.05 * luck) dropPickup(w, 'coin', e.x + 4, e.y, (1 + Math.floor(minutes(w) / 8)) * runGold(w.config));
    else if (roll > 0.996) dropPickup(w, 'heart', e.x, e.y, 30);
    else if (roll > 0.9945) dropPickup(w, 'magnet', e.x, e.y, 1);
  }
  if (e.def.splitsInto && !e.elite) {
    const child = ENEMY_BY_ID.get(e.def.splitsInto);
    if (child) {
      spawnEnemy(w, child, e.x - 6, e.y + 2);
      spawnEnemy(w, child, e.x + 6, e.y - 2);
    }
  }
  emit(w, { type: 'puff', x: e.x, y: e.y, color: 0xffffff, count: boss ? 24 : e.elite ? 12 : 4 });
}

/**
 * Daño de un arma a un enemigo: aplica poder y críticos, retroceso y, si muere, el botín.
 * (kx, ky) es la dirección del retroceso multiplicada por su fuerza.
 */
export function damageEnemy(w: World, e: Enemy, base: number, weapon: number, kx: number, ky: number) {
  // La Muerte no recibe daño.
  if (e.dead || e.def.ai === 'reaper') return;
  const stats = w.player.stats;
  const crit = rand(w) < stats.critChance;
  const dmg = Math.max(1, Math.round(base * stats.might * (crit ? stats.critMult : 1)));
  e.hp -= dmg;
  e.flash = 0.1;
  if (stats.leech > 0) w.player.hp = Math.min(stats.maxHp, w.player.hp + dmg * stats.leech);
  const resist = 1 - e.def.knockResist;
  e.kx += kx * resist;
  e.ky += ky * resist;
  const ws = w.player.weapons[weapon];
  if (ws) ws.dealt += dmg;
  emit(w, { type: 'number', x: e.x, y: e.y - e.radius, value: dmg, crit, player: false });
  if (e.hp <= 0) killEnemy(w, e);
}

export function hurtPlayer(w: World, amount: number) {
  const p = w.player;
  if (p.hurtTimer > 0 || w.phase !== 'playing') return;
  const dmg = Math.max(1, Math.round(amount - p.stats.armor));
  p.hp -= dmg;
  p.hurtTimer = 0.5;
  emit(w, { type: 'number', x: p.x, y: p.y - 10, value: dmg, crit: false, player: true });
  emit(w, { type: 'shake', power: 3 });
}
