import { CYCLE_BOSS_BY_ID, REAPER } from '../content/bosses';
import { ENEMY_BY_ID } from '../content/enemies';
import { emit, hurtPlayer, maxEnemies, rand, ringPoint, spawnEnemy } from './core';
import type { BossPattern, Enemy, EnemyDef, Hazard, World } from './types';
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
  quake: 1.8,
  eggs: 0.6,
  slow: 0.5,
  clones: 0.6,
  heads: 0.6,
  pools: 0.6,
  sweep: 3,
  laser: 1.5,
  gravity: 3,
};

/** Huevo de la Madre de la Nidada: si no se rompe a tiempo, eclosiona en esbirros. */
export const EGG: EnemyDef = {
  id: 'egg',
  name: 'Huevo',
  sprite: 'e_egg',
  hp: 90,
  speed: 0,
  damage: 0,
  radius: 7,
  xp: 2,
  ai: 'egg',
  knockResist: 1,
};
/** Segundos hasta que eclosiona un huevo y esbirros que salen. */
export const EGG_HATCH = { after: 4, minions: 4 };

/** Copias del jefe (sombras y cabezas): disparan ráfagas y caen pronto. */
const copyOf = (e: Enemy, id: 'clone' | 'head'): EnemyDef => ({
  id,
  name: id === 'clone' ? 'Sombra' : 'Cabeza',
  sprite: e.def.sprite,
  hp: id === 'clone' ? 220 : 380,
  speed: id === 'clone' ? 34 : 0,
  damage: e.def.damage * 0.5,
  radius: id === 'clone' ? 12 : 10,
  xp: 5,
  ai: 'volley',
  knockResist: id === 'clone' ? 0.5 : 1,
});

function hazard(w: World, h: Hazard) {
  (w.hazards ??= []).push(h);
}

/** Rayo desde el jefe en la dirección `angle`. */
function beam(w: World, e: Enemy, angle: number, at: number, until: number, width = 8, length = 300) {
  hazard(w, {
    kind: 'beam',
    x: e.x,
    y: e.y,
    x2: e.x + Math.cos(angle) * length,
    y2: e.y + Math.sin(angle) * length,
    at,
    until,
    radius: width,
    damage: e.damage * BOSS_TUNING.shot * 1.5,
    color: e.def.color,
  });
}

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
  e.t1 = 0;
  // Nada salva de La Muerte: sin revivir.
  w.player.stats.revival = 0;
  w.completed = true;
  emit(w, { type: 'shake', power: 10 });
}

/** Segundos entre tajos de La Muerte. Cada tajo mata (12/11/2026): ni regeneración, ni vida ni mejoras lo aguantan. */
export const REAPER_STRIKE = { every: 0.8 };

/** Tajo de guadaña: mata siempre (ignora armadura, invulnerabilidad, revivir y regeneración). Devuelve si ha golpeado. */
export function reaperStrike(w: World, e: Enemy): boolean {
  if (e.t1 > 0) return false;
  const p = w.player;
  e.t1 = REAPER_STRIKE.every;
  const dmg = Math.ceil(Math.max(p.hp, p.stats.maxHp));
  p.stats.revival = 0;
  // Muy por debajo de 0: nada de lo que cura en el mismo paso (regeneración, robo de vida) puede salvarlo.
  p.hp = -1e12;
  p.hurtTimer = 0.3;
  emit(w, { type: 'number', x: p.x, y: p.y - 10, value: dmg, crit: true, player: true });
  emit(w, { type: 'ring', x: p.x, y: p.y, radius: 18, color: 0xe5484d });
  emit(w, { type: 'puff', x: p.x, y: p.y, count: 12, color: 0x9b2335 });
  emit(w, { type: 'shake', power: 7 });
  return true;
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
    case 'quake': {
      // Ondas que se abren desde el jefe: hay que cruzarlas por el hueco entre una y otra o alejarse.
      const waves = 3 + Math.min(2, round);
      for (let i = 0; i < waves; i++) {
        const inner = 26 + i * 62;
        hazard(w, {
          kind: 'ring',
          x: e.x,
          y: e.y,
          inner,
          radius: inner + 26,
          at: w.time + 0.7 + i * 0.35,
          damage: e.damage * BOSS_TUNING.shot * 2,
        });
      }
      emit(w, { type: 'shake', power: 5 });
      break;
    }
    case 'eggs': {
      const count = 3 + round;
      for (let i = 0; i < count; i++) {
        const a = rand(w) * Math.PI * 2;
        const d = 60 + rand(w) * 70;
        const egg = spawnEnemy(w, EGG, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        egg.t1 = EGG_HATCH.after;
      }
      break;
    }
    case 'slow': {
      // Telarañas o burbujas de tiempo: ralentizan mientras se pisan.
      const count = 3 + round;
      for (let i = 0; i < count; i++) {
        const a = rand(w) * Math.PI * 2;
        const d = i === 0 ? 0 : 40 + rand(w) * 80;
        hazard(w, {
          kind: 'slow',
          x: p.x + Math.cos(a) * d,
          y: p.y + Math.sin(a) * d,
          radius: 40,
          at: w.time + 0.6,
          until: w.time + 7,
          damage: 0,
          color,
        });
      }
      break;
    }
    case 'clones':
    case 'heads': {
      const count = 2 + Math.min(2, round);
      const def = copyOf(e, pattern === 'clones' ? 'clone' : 'head');
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand(w);
        const c = spawnEnemy(w, def, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
        c.t1 = 1 + i * 0.4;
      }
      emit(w, { type: 'ring', x: e.x, y: e.y, radius: 40, color });
      break;
    }
    case 'pools': {
      const count = 3 + 2 * round;
      for (let i = 0; i < count; i++) {
        const a = rand(w) * Math.PI * 2;
        const d = i === 0 ? 0 : 30 + rand(w) * 90;
        hazard(w, {
          kind: 'zone',
          x: p.x + Math.cos(a) * d,
          y: p.y + Math.sin(a) * d,
          radius: 28,
          at: w.time + 0.9,
          until: w.time + 6,
          damage: e.damage * BOSS_TUNING.shot,
          color,
        });
      }
      break;
    }
    case 'sweep': {
      // Un rayo gira media vuelta alrededor del jefe; se avisa la dirección de salida.
      const steps = 16;
      const dir = rand(w) < 0.5 ? -1 : 1;
      const start = toPlayer - dir * (Math.PI / 2);
      for (let i = 0; i < steps; i++) {
        const angle = start + dir * i * (Math.PI / steps) * (1 + 0.15 * round);
        beam(w, e, angle, w.time + 0.8 + i * 0.12, w.time + 1.0 + i * 0.12);
      }
      break;
    }
    case 'laser': {
      // Rayos avisados hacia el jugador y a sus lados; se disparan todos a la vez.
      const count = 3 + round;
      for (let i = 0; i < count; i++) beam(w, e, toPlayer + (i - (count - 1) / 2) * 0.45, w.time + 0.9, w.time + 1.4, 10, 340);
      break;
    }
    case 'gravity':
      emit(w, { type: 'ring', x: e.x, y: e.y, radius: 120, color });
      break;
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
  if (current === 'gravity') {
    // Atrae al jugador hacia sus fauces mientras suelta anillos lentos.
    const p = w.player;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const pull = (40 + 10 * round) * dt;
    p.x += (dx / d) * pull;
    p.y += (dy / d) * pull;
    if (Math.floor(e.sub * 2) !== Math.floor((e.sub + dt) * 2)) ring(w, e, 10 + 2 * round, 55, rand(w) * Math.PI);
    velocity = [0, 0];
  } else if (current === 'sweep' || current === 'laser' || current === 'quake') {
    velocity = [0, 0];
  } else if (current === 'spiral') {
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

/** Distancia de un punto a un segmento. */
function segmentDistance(px: number, py: number, h: Hazard) {
  const dx = (h.x2 ?? h.x) - h.x;
  const dy = (h.y2 ?? h.y) - h.y;
  const t = Math.max(0, Math.min(1, ((px - h.x) * dx + (py - h.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (h.x + dx * t), py - (h.y + dy * t));
}

/** Zonas de los ataques de los jefes: estallan al llegar su momento o actúan mientras duran. */
export function updateHazards(w: World) {
  w.slowed = false;
  if (!w.hazards?.length) return;
  const p = w.player;
  let kept = 0;
  for (const h of w.hazards) {
    if (w.time < h.at) {
      w.hazards[kept++] = h;
      continue;
    }
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    const kind = h.kind ?? 'blast';
    if (kind === 'blast' || kind === 'ring') {
      const hit = kind === 'blast' ? d < h.radius + 5 : d > (h.inner ?? 0) - 5 && d < h.radius + 5;
      if (hit) hurtPlayer(w, h.damage);
      emit(w, { type: 'ring', x: h.x, y: h.y, radius: h.radius, color: 0xff5a3c });
      continue;
    }
    if (w.time >= (h.until ?? h.at)) continue;
    w.hazards[kept++] = h;
    if (kind === 'slow') {
      if (d < h.radius) w.slowed = true;
    } else if (kind === 'zone') {
      if (d < h.radius) hurtPlayer(w, h.damage);
    } else if (segmentDistance(p.x, p.y, h) < h.radius + 4) hurtPlayer(w, h.damage);
  }
  w.hazards.length = kept;
}
