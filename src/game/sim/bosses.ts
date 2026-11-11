import { CYCLE_BOSS_BY_ID, REAPER } from '../content/bosses';
import { ENEMY_BY_ID } from '../content/enemies';
import { emit, hurtPlayer, maxEnemies, rand, ringPoint, spawnEnemy } from './core';
import type { BossPattern, Enemy, World } from './types';
import { enemyShot } from './weapons';

/**
 * Jefes de ciclo y La Muerte (HABITS_GUIDE §11). Todo es determinista (usa el azar de la partida) y se guarda en
 * el propio enemigo, así que una partida guardada con un jefe en pantalla se reanuda igual.
 */

/**
 * Ajuste de los jefes con el estudio de jefes (ANALISIS_ECONOMIA.md §11): en la frontera de un jugador constante, un
 * nivel de jefe debe superarse en ~1 de cada 3 intentos (frente a ~1 de cada 2 en un nivel normal).
 */
export const BOSS_TUNING = {
  /** Vida sobre la de su definición. */
  hp: 0.6,
  /** Daño de sus proyectiles y zonas respecto a su daño de contacto. */
  shot: 0.35,
  /** Segundos entre ataques en la primera vuelta. */
  cooldown: 3,
};

/** Vuelta de la rotación de la partida (0 = primera). */
const roundOf = (w: World) => w.config.cycleBoss?.round ?? 0;

/** Ataques del jefe en esta vuelta: los suyos y, desde la segunda, también los avanzados. */
export function patternsOf(e: Enemy, round: number): BossPattern[] {
  const base = e.def.patterns ?? [];
  return round >= 1 ? [...base, ...(e.def.advanced ?? [])] : base;
}

/** Duración de cada ataque (segundos durante los que el jefe está ocupado). */
const DURATION: Record<BossPattern, number> = {
  radial: 0.4,
  fan: 0.4,
  spiral: 2.2,
  charge: 1.5,
  blink: 0.6,
  summon: 0.5,
  rain: 0.5,
  wall: 0.4,
};

/** Saca al jefe de ciclo de la partida. */
export function spawnCycleBoss(w: World) {
  const ref = w.config.cycleBoss;
  const def = ref && CYCLE_BOSS_BY_ID.get(ref.id);
  if (!def) return;
  const at = ringPoint(w);
  const e = spawnEnemy(w, def, at.x, at.y);
  const round = ref.round;
  e.hp *= BOSS_TUNING.hp * (1 + 0.25 * round);
  e.maxHp = e.hp;
  e.damage *= 1 + 0.1 * round;
  e.t1 = 2;
  e.pattern = 0;
  e.sub = 0;
  e.aim = 0;
  w.cycleBoss = 1;
  w.bossAlive = true;
  emit(w, { type: 'shake', power: 8 });
}

/** Saca a La Muerte, que persigue al jugador más rápido de lo que puede huir. */
export function spawnReaper(w: World) {
  const at = ringPoint(w, undefined, 220);
  const e = spawnEnemy(w, REAPER, at.x, at.y);
  e.speed = Math.max(140, w.player.stats.moveSpeed * 2.2);
  w.completed = true;
  emit(w, { type: 'shake', power: 10 });
}

/** La Muerte no se puede esquivar: al tocar al jugador acaba la partida, sin revivir ni invulnerabilidad. */
export function reaperTouch(w: World) {
  w.player.stats.revival = 0;
  w.player.hp = 0;
}

function ring(w: World, e: Enemy, count: number, speed: number, offset: number) {
  for (let i = 0; i < count; i++) enemyShot(w, e.x, e.y, offset + (i / count) * Math.PI * 2, speed, e.damage * BOSS_TUNING.shot);
}

/** Empieza un ataque. */
function begin(w: World, e: Enemy, pattern: BossPattern, round: number, toPlayer: number) {
  const color = e.def.color ?? 0xffffff;
  const p = w.player;
  switch (pattern) {
    case 'radial':
      ring(w, e, 12 + 4 * round, 75, rand(w) * Math.PI);
      emit(w, { type: 'ring', x: e.x, y: e.y, radius: e.radius + 10, color });
      break;
    case 'fan': {
      const n = 5 + 2 * round;
      for (let i = 0; i < n; i++) enemyShot(w, e.x, e.y, toPlayer + (i - (n - 1) / 2) * 0.18, 110, e.damage * BOSS_TUNING.shot, 'x_arrow');
      break;
    }
    case 'spiral':
      e.aim = rand(w) * Math.PI * 2;
      break;
    case 'charge':
      // Fase 1 (0,7 s): se detiene y avisa; fase 2: embiste en la dirección fijada.
      e.aim = toPlayer;
      emit(w, { type: 'ring', x: e.x, y: e.y, radius: e.radius + 14, color });
      break;
    case 'blink': {
      const angle = rand(w) * Math.PI * 2;
      e.x = p.x + Math.cos(angle) * 95;
      e.y = p.y + Math.sin(angle) * 95;
      emit(w, { type: 'ring', x: e.x, y: e.y, radius: 30, color });
      ring(w, e, 8 + 2 * round, 65, angle);
      break;
    }
    case 'summon': {
      const minion = ENEMY_BY_ID.get(e.def.minion ?? 'bones');
      const count = 6 + 2 * round;
      for (let i = 0; i < count && minion && w.enemies.length < maxEnemies(w) + 20; i++) {
        const a = (i / count) * Math.PI * 2;
        spawnEnemy(w, minion, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30);
      }
      emit(w, { type: 'ring', x: e.x, y: e.y, radius: 34, color });
      break;
    }
    case 'rain': {
      // Zonas marcadas alrededor del jugador que estallan un segundo después.
      w.hazards ??= [];
      const count = 4 + 2 * round;
      for (let i = 0; i < count; i++) {
        const a = rand(w) * Math.PI * 2;
        const d = i === 0 ? 0 : 20 + rand(w) * 70;
        w.hazards.push({
          x: p.x + Math.cos(a) * d,
          y: p.y + Math.sin(a) * d,
          at: w.time + 1,
          radius: 22,
          damage: e.damage * BOSS_TUNING.shot * 2,
        });
      }
      break;
    }
    case 'wall': {
      // Un anillo alrededor del jugador que se cierra, con un hueco por el que escapar.
      const count = 20;
      const gap = Math.floor(rand(w) * count);
      for (let i = 0; i < count; i++) {
        if (Math.abs(i - gap) <= 1 || Math.abs(i - gap) >= count - 1) continue;
        const a = (i / count) * Math.PI * 2;
        const x = p.x + Math.cos(a) * 210;
        const y = p.y + Math.sin(a) * 210;
        enemyShot(w, x, y, a + Math.PI, 55 + 5 * round, e.damage * BOSS_TUNING.shot);
      }
      break;
    }
  }
}

/**
 * Comportamiento de un jefe de ciclo. Devuelve la velocidad que debe llevar este paso, o null para que siga
 * persiguiendo al jugador como cualquier enemigo.
 */
export function updateCycleBoss(w: World, e: Enemy, dt: number, toPlayer: number): [number, number] | null {
  const round = roundOf(w);
  const patterns = patternsOf(e, round);
  if (patterns.length === 0) return null;
  const enraged = round >= 1 && e.hp < e.maxHp * 0.5;
  const cooldown = Math.max(1, (BOSS_TUNING.cooldown / (1 + 0.15 * round)) * (enraged ? 0.7 : 1));
  const current = patterns[(e.pattern ?? 0) % patterns.length];

  if (e.state === 0) {
    e.t1 -= dt;
    if (e.t1 > 0) return null;
    e.state = 1;
    e.sub = DURATION[current];
    begin(w, e, current, round, toPlayer);
  }

  e.sub = (e.sub ?? 0) - dt;
  let velocity: [number, number] | null = null;
  if (current === 'spiral') {
    // Brazos de disparos que giran (más brazos en cada vuelta), una tanda cada 0,1 s.
    if (Math.floor(e.sub * 10) !== Math.floor((e.sub + dt) * 10)) {
      const arms = 2 + Math.min(3, round);
      for (let i = 0; i < arms; i++) enemyShot(w, e.x, e.y, (e.aim ?? 0) + (i / arms) * Math.PI * 2, 80, e.damage * BOSS_TUNING.shot);
      e.aim = (e.aim ?? 0) + 0.32;
    }
    velocity = [0, 0];
  } else if (current === 'charge') {
    const dashing = e.sub < DURATION.charge - 0.7;
    const speed = dashing ? e.speed * 5 : 0;
    velocity = [Math.cos(e.aim ?? 0) * speed, Math.sin(e.aim ?? 0) * speed];
  }

  if (e.sub <= 0) {
    e.state = 0;
    e.pattern = (e.pattern ?? 0) + 1;
    e.t1 = cooldown;
  }
  return velocity;
}

/** Zonas de los ataques en área: estallan al llegar su momento. */
export function updateHazards(w: World) {
  if (!w.hazards?.length) return;
  const p = w.player;
  let kept = 0;
  for (const h of w.hazards) {
    if (w.time < h.at) {
      w.hazards[kept++] = h;
      continue;
    }
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    if (dx * dx + dy * dy < (h.radius + 5) ** 2) hurtPlayer(w, h.damage);
    emit(w, { type: 'ring', x: h.x, y: h.y, radius: h.radius, color: 0xff5a3c });
  }
  w.hazards.length = kept;
}
