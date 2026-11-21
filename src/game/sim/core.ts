import { ENEMY_BY_ID } from '../content/enemies';
import { WEAPON_BY_ID } from '../content/weapons';
import { runDamage, runDensity, runGold, runHp } from './difficulty';
import { TIMELINE, type Enemy, type EnemyDef, type Fx, type PickupKind, type World } from './types';

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
/** Minutos de las tablas (30 de largo); la partida real dura la mitad (`TIMELINE`). */
const minutes = (w: World) => (w.time * TIMELINE) / 60;
/**
 * Escalada dentro de cada partida (se multiplica por la dureza del nivel, así cada nivel empieza más arriba y vuelve
 * a subir durante sus 15 minutos). Ritmo del género (17/11/2026): los primeros minutos son un respiro para montar la
 * build, la presión llega sobre todo por número de enemigos y el personaje, bien mejorado, va por delante de la vida
 * de los enemigos a mitad de partida. Minutos reales, respecto al minuto 0:
 * - Vida: ×1,2 en el minuto 1, ×3,3 en el 7 y ×10 en el 15.
 * - Daño: ×1,1 / ×1,6 / ×2,5 (antes ×6 al final: un par de golpes bastaban para morir).
 * - Veteranos: desde el minuto 4, una parte creciente de las apariciones normales sale reforzada (hasta 1 de cada 8
 *   en el 15), con más vida y daño.
 */
export const RAMP = {
  hp: [0.08, 0.0075],
  damage: [0.035, 0.0005],
  /** Veteranos: minuto en que empiezan, fracción en el 30 y refuerzo (vida, daño, tamaño, experiencia). */
  champion: { from: 8, share: 1 / 8, hp: 3, damage: 1.3, radius: 1.2, xp: 3 },
};
/**
 * Vida extra de los enemigos especiales sobre la escalada de la partida: los jefes (de escenario y de ciclo) ×10 y las
 * élites que sueltan cofre ×15 (17/11/2026: con ×25 la primera élite, al minuto 0:45, era casi imposible de abatir y el
 * cofre es la principal fuente de mejoras al principio).
 */
export const TOUGHNESS = { boss: 10, elite: 15 };
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
export const WAVES = { from: 34, to: 50, surge: 2, lull: 0.5, cap: 1.25, ring: 10, ringPerMinute: 1 };
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

/** Maldición del jugador (las partidas guardadas antes de ella no tienen el campo). */
export const curseOf = (w: World) => w.player.stats.curse ?? 1;

export function spawnEnemy(w: World, def: EnemyDef, x: number, y: number, elite = false, champion = false): Enemy {
  const c = champion && !elite ? RAMP.champion : null;
  const hp = def.hp * hpScale(w) * curseOf(w) * (elite ? TOUGHNESS.elite : 1) * (def.ai === 'boss' ? TOUGHNESS.boss : 1) * (c?.hp ?? 1);
  const e: Enemy = {
    uid: w.nextUid++,
    def,
    x,
    y,
    hp,
    maxHp: hp,
    damage: def.damage * damageScale(w) * (elite ? 1.5 : 1) * (c?.damage ?? 1),
    speed: def.speed * speedScale(w) * (1 + (curseOf(w) - 1) / 2),
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
export const HEART_HEAL_FRACTION = 0.2;

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

export function killEnemy(w: World, e: Enemy) {
  e.dead = true;
  w.kills += 1;
  const luck = w.player.stats.luck;
  const boss = e.def.ai === 'boss';
  // En niveles con más densidad salen más enemigos: cada uno da menos experiencia para que el ritmo de subida sea parecido.
  dropPickup(w, 'xp', e.x, e.y, (e.def.xp * (e.elite ? 10 : e.champion ? RAMP.champion.xp : 1)) / runDensity(w.config));
  if (boss) {
    w.bossAlive = w.enemies.some((o) => !o.dead && o.def.ai === 'boss');
    if (e.def.patterns) w.cycleBoss = 2;
    dropPickup(w, 'chest', e.x + 10, e.y, 2); // valor 2 = cofre de jefe
    dropPickup(w, 'coin', e.x - 10, e.y, (e.def.patterns ? 300 : 60) * runGold(w.config));
    emit(w, { type: 'shake', power: 6 });
  } else if (e.elite) {
    dropPickup(w, 'chest', e.x, e.y + 6, 1);
  } else {
    const roll = rand(w);
    if (roll < 0.05 * luck) dropPickup(w, 'coin', e.x + 4, e.y, (1 + Math.floor(minutes(w) / 8)) * TIMELINE * runGold(w.config));
    else if (roll > 0.996) dropPickup(w, 'heart', e.x, e.y, HEART_HEAL_FRACTION);
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
 * Efectos propios de algunas armas al golpear (curar, ralentizar, estallar con los críticos…), por id del arma: los
 * registra sim/weapons.ts. No pueden consultar la rejilla (quien los llama puede estar recorriendo `near`).
 */
export const ON_HIT: Record<string, (w: World, e: Enemy, dmg: number, weapon: number, crit: boolean) => void> = {};

/** Ganchos que registra sim/weapons.ts: al recibir un golpe (contraataques) y críticos especiales por arma. */
export const HOOKS: {
  hurt?: (w: World, amount: number) => void;
  /** Un arma (índice en `player.weapons`) abate a un enemigo. */
  kill?: (w: World, weapon: number) => void;
  /** Probabilidad de crítico extra del arma en su estado actual. */
  crit?: (w: World, weapon: number) => number;
} = {};

/** Armas cuyos críticos no multiplican el daño (estallan en su lugar: Rayo Sobrenatural). */
const FLAT_CRITS = new Set(['unearthly', 'spirit']);

/** Cura de las armas (Látigo de Sangre, Engullealmas…): con tope por segundo, como el robo de vida. */
export function healPlayer(w: World, amount: number) {
  const p = w.player;
  const healed = Math.min(amount, p.healPool ?? 0);
  p.healPool = (p.healPool ?? 0) - healed;
  heal(w, healed);
}

/** ¿Lleva la partida esa arcana o darkana? */
export const hasArcana = (w: World, id: string) => w.config.arcana?.includes(id) ?? false;

/** Radio y umbral de la onda de la Sarabanda de la curación. */
const SARABANDE = { radius: 90, threshold: 4 };

/**
 * Toda la curación pasa por aquí. Con la Sarabanda de la curación se duplica y la vida recuperada se devuelve como
 * daño a los enemigos cercanos (acumulada, para que la regeneración continua no haga daño a cada fotograma).
 */
export function heal(w: World, amount: number) {
  const p = w.player;
  if (amount <= 0) return;
  const sarabande = hasArcana(w, 'sarabande');
  const before = p.hp;
  p.hp = Math.min(p.stats.maxHp, p.hp + (sarabande ? amount * 2 : amount));
  if (!sarabande) return;
  p.healBlast = (p.healBlast ?? 0) + (p.hp - before);
  if (p.healBlast < SARABANDE.threshold) return;
  const damage = p.healBlast;
  p.healBlast = 0;
  const count = queryNear(p.x, p.y, SARABANDE.radius * p.stats.area);
  const targets = near.slice(0, count);
  for (const e of targets) damageEnemy(w, e, damage / p.stats.might, -1, 0, 0, true);
  emit(w, { type: 'ring', x: p.x, y: p.y, radius: SARABANDE.radius * p.stats.area, color: 0xff7a9a });
}

/**
 * Daño de un arma a un enemigo: aplica poder y críticos, retroceso y, si muere, el botín.
 * (kx, ky) es la dirección del retroceso multiplicada por su fuerza. `secondary`: daño derivado (explosiones de un
 * crítico, represalias) que no vuelve a disparar los efectos al golpear.
 */
export function damageEnemy(w: World, e: Enemy, base: number, weapon: number, kx: number, ky: number, secondary = false) {
  // La Muerte no recibe daño.
  if (e.dead || e.def.ai === 'reaper') return;
  const stats = w.player.stats;
  const ws = w.player.weapons[weapon];
  const extra = ws && !secondary ? (WEAPON_BY_ID.get(ws.id)?.crit ?? 0) + (HOOKS.crit?.(w, weapon) ?? 0) : 0;
  const crit = rand(w) < stats.critChance * stats.luck + extra;
  const mult = crit && !(ws && FLAT_CRITS.has(ws.id)) ? stats.critMult : 1;
  const dmg = Math.max(1, Math.round(base * stats.might * mult));
  e.hp -= dmg;
  e.flash = 0.1;
  if (stats.leech > 0) {
    const leeched = Math.min(dmg * stats.leech, w.player.leechPool ?? 0);
    w.player.leechPool = (w.player.leechPool ?? 0) - leeched;
    heal(w, leeched);
  }
  const resist = 1 - e.def.knockResist;
  e.kx += kx * resist;
  e.ky += ky * resist;
  if (ws) ws.dealt += dmg;
  emit(w, { type: 'number', x: e.x, y: e.y - e.radius, value: dmg, crit, player: false });
  if (ws && !secondary) ON_HIT[ws.id]?.(w, e, dmg, weapon, crit);
  if (e.hp <= 0 && !e.dead) {
    killEnemy(w, e);
    if (ws) HOOKS.kill?.(w, weapon);
  }
}

/** Sudario Carmesí: tope de daño por golpe y represalia (daño recibido, con tope, +10 % por nivel de Coraza). */
const SHROUD = { cap: 10, retaliationCap: 100, armorBonus: 0.1 };

/**
 * Golpe al jugador. El Laurel (y el Sudario) gastan una carga en vez de recibir el daño; el Sudario además limita el
 * daño y, con cada carga gastada, estalla devolviéndolo.
 */
export function hurtPlayer(w: World, amount: number) {
  const p = w.player;
  if (p.hurtTimer > 0 || w.phase !== 'playing') return;
  HOOKS.hurt?.(w, amount);
  const shroud = p.weapons.findIndex((x) => x.id === 'thornmail');
  const laurel = shroud >= 0 ? shroud : p.weapons.findIndex((x) => x.id === 'laurel');
  if (laurel >= 0 && (p.shield ?? 0) >= 1) {
    const ws = p.weapons[laurel];
    p.shield = (p.shield ?? 1) - 1;
    p.hurtTimer = 0.5 + ws.stats.duration * p.stats.duration;
    emit(w, { type: 'ring', x: p.x, y: p.y, radius: 16, color: shroud >= 0 ? 0xff5a6a : 0x9fe8a0 });
    if (shroud >= 0) {
      const armor = p.passives.find((x) => x.id === 'scales')?.level ?? 0;
      const dmg = Math.min(SHROUD.retaliationCap, amount) * (1 + SHROUD.armorBonus * armor) * (p.stats.curse ?? 1);
      const radius = ws.stats.area * p.stats.area;
      for (let k = 0; k < 1 + p.stats.amount; k++) {
        const cx = p.x + (k === 0 ? 0 : (rand(w) - 0.5) * radius);
        const cy = p.y - 8 + (k === 0 ? 0 : (rand(w) - 0.5) * radius);
        const count = queryNear(cx, cy, radius);
        const targets = near.slice(0, count);
        for (const e of targets) {
          const d = Math.hypot(e.x - cx, e.y - cy) || 1;
          damageEnemy(w, e, dmg, laurel, ((e.x - cx) / d) * ws.stats.knockback, ((e.y - cy) / d) * ws.stats.knockback, true);
        }
        emit(w, { type: 'ring', x: cx, y: cy, radius, color: 0xff5a6a });
        emit(w, { type: 'ring', x: cx, y: cy, radius: radius * 0.55, color: 0xffd0d6 });
      }
      emit(w, { type: 'shake', power: 3 });
    }
    return;
  }
  let dmg = Math.max(1, Math.round(amount - p.stats.armor));
  if (shroud >= 0) dmg = Math.min(dmg, SHROUD.cap);
  p.hp -= dmg;
  p.hurtTimer = 0.5;
  emit(w, { type: 'number', x: p.x, y: p.y - 10, value: dmg, crit: false, player: true });
  emit(w, { type: 'shake', power: 3 });
}
