import { CYCLE_BOSS_AT } from '../content/bosses';
import { ENEMY_BY_ID } from '../content/enemies';
import { EGG_HATCH, reaperStrike, spawnCycleBoss, spawnReaper, updateCycleBoss, updateHazards } from './bosses';
import { championChance, emit, hurtPlayer, maxEnemies, near, queryNear, rand, rebuildGrid, ringPoint, spawnEnemy, WAVES, waveFactor } from './core';
import { runDensity, survivalBonus } from './difficulty';
import { MAX_WEAPONS, RUN_SECONDS, type Enemy, type RunConfig, type RunResult, type World } from './types';
import { applyChoice, newWeapon, openChest, recomputeStats, rollChoices } from './upgrades';
import { enemyShot, updateProjectiles, updateWeapons } from './weapons';

/** Estado inicial de una partida. */
/** Azar fijo por semilla que no consume el azar de la partida. */
const seedRoll = (seed: number, salt: number) => (Math.imul((seed ^ salt) | 0, 2654435761) >>> 0) / 4294967296;

/** Una de cada cinco partidas ofrece la mejora de eliminar, una sola vez, entre los niveles 8 y 37. */
export const PURGE = { chance: 0.2, from: 8, span: 30 };
const purgeLevel = (seed: number) =>
  seedRoll(seed, 0x5bd1e995) < PURGE.chance ? PURGE.from + Math.floor(seedRoll(seed, 0x27d4eb2f) * PURGE.span) : undefined;

export function createWorld(config: RunConfig): World {
  return {
    purgeAt: purgeLevel(config.seed),
    config,
    rngState: config.seed | 0,
    phase: 'playing',
    time: 0,
    player: {
      x: 0,
      y: 0,
      hp: config.stats.maxHp,
      dirX: 1,
      dirY: 0,
      moving: false,
      hurtTimer: 0,
      level: 1,
      xp: 0,
      xpNext: xpForLevel(1),
      stats: { ...config.stats },
      weapons: [config.startingWeapon, ...(config.bonusWeapons ?? [])].slice(0, MAX_WEAPONS).map(newWeapon),
      passives: [],
      rerolls: config.stats.rerolls ?? 0,
      banishes: config.stats.banishes ?? 0,
      banished: [],
    },
    enemies: [],
    projectiles: [],
    pickups: [],
    fx: [],
    nextUid: 1,
    kills: 0,
    gold: 0,
    pendingLevels: 0,
    choices: [],
    chestRewards: [],
    spawnAcc: config.stage.spawns.map(() => 0),
    nextEvent: 0,
    bossAlive: false,
  };
}

/** Escala de la experiencia por nivel: ajustada para llegar a ~nivel 60 en el minuto 30 (ANALISIS_ECONOMIA.md §12). */
export const XP_SCALE = 1.05;

/** Experiencia necesaria para pasar del nivel `level` al siguiente. */
export const xpForLevel = (level: number) => Math.round((5 + (level - 1) * 5 + Math.floor(Math.pow(level - 1, 1.9) * 0.6)) * XP_SCALE);

// ── Aparición de enemigos ───────────────────────────────────────────────────────────────────────

/** Fin de la última fase de aparición de los escenarios: en el modo infinito se repite desde aquí. */
const LOOP_FROM = 20;

/** Ritmo base de aparición sobre el de las tablas de cada escenario (partidas más frenéticas). */
export const SPAWN_RATE = 1.5;

function updateSpawns(w: World, dt: number) {
  const { stage } = w.config;
  // Modo infinito: pasado el minuto 30 se repiten los últimos 10 minutos de apariciones (la dureza sigue subiendo).
  const real = w.time / 60;
  const minute = real < 30 ? real : LOOP_FROM + ((real - LOOP_FROM) % 10);
  const cap = maxEnemies(w);
  const density = runDensity(w.config) * SPAWN_RATE * waveFactor(w);
  // Comienzo de cada oleada: anillo del último enemigo en aparecer del escenario.
  const wave = Math.floor((w.time - WAVES.from) / 60);
  if (wave >= (w.waves ?? 0) && w.time >= WAVES.from) {
    w.waves = wave + 1;
    const rule = stage.spawns.filter((r) => minute >= r.from && minute < r.to).pop();
    const def = rule && ENEMY_BY_ID.get(rule.enemy);
    const count = Math.round((WAVES.ring + minute * WAVES.ringPerMinute) * runDensity(w.config));
    for (let i = 0; i < count && def && w.enemies.length < cap; i++) {
      const at = ringPoint(w, (i / count) * Math.PI * 2, 300);
      spawnEnemy(w, def, at.x, at.y);
    }
    emit(w, { type: 'shake', power: 2 });
  }
  for (let i = 0; i < stage.spawns.length; i++) {
    const rule = stage.spawns[i];
    if (minute < rule.from || minute >= rule.to) continue;
    const t = (minute - rule.from) / (rule.to - rule.from);
    w.spawnAcc[i] += (rule.rateStart + (rule.rateEnd - rule.rateStart) * t) * density * dt;
    const def = ENEMY_BY_ID.get(rule.enemy);
    while (w.spawnAcc[i] >= 1) {
      w.spawnAcc[i] -= 1;
      if (!def || w.enemies.length >= cap) continue; // con el mapa lleno la aparición se pierde
      const at = ringPoint(w);
      const chance = championChance(w);
      spawnEnemy(w, def, at.x, at.y, false, chance > 0 && rand(w) < chance);
    }
  }

  if (w.config.cycleBoss && !w.cycleBoss && w.time >= CYCLE_BOSS_AT) spawnCycleBoss(w);

  const loops = w.eventLoops ?? 0;
  if (w.config.mode === 'infinite' && w.nextEvent >= stage.events.length && w.time >= (loops + 1) * RUN_SECONDS) {
    w.eventLoops = loops + 1;
    w.nextEvent = 0;
  }
  const offset = (w.eventLoops ?? 0) * RUN_SECONDS;
  while (w.nextEvent < stage.events.length && stage.events[w.nextEvent].at + offset <= w.time) {
    const event = stage.events[w.nextEvent++];
    const def = ENEMY_BY_ID.get(event.enemy);
    if (!def) continue;
    // En los niveles de jefe, el jefe de ciclo sustituye al del escenario del minuto 20.
    if (w.config.cycleBoss && event.kind === 'boss' && event.at === CYCLE_BOSS_AT) continue;
    for (let i = 0; i < event.count; i++) {
      // Los anillos rodean al jugador a intervalos iguales; élites y jefes llegan por un punto al azar.
      const at = event.kind === 'ring' ? ringPoint(w, (i / event.count) * Math.PI * 2, 300) : ringPoint(w);
      spawnEnemy(w, def, at.x, at.y, event.kind === 'elite');
    }
    if (event.kind === 'boss') w.bossAlive = true;
  }
}

// ── Enemigos ────────────────────────────────────────────────────────────────────────────────────

const PLAYER_RADIUS = 5;
/** Un enemigo que queda muy lejos (el jugador huyó) reaparece al otro lado en vez de perderse. */
const RECYCLE_DISTANCE = 480;

function updateEnemy(w: World, e: Enemy, dt: number) {
  const { player } = w;
  e.flash -= dt;
  e.contactCd -= dt;
  let dx = player.x - e.x;
  let dy = player.y - e.y;
  let dist = Math.hypot(dx, dy) || 1;

  if (dist > RECYCLE_DISTANCE) {
    const at = ringPoint(w);
    e.x = at.x;
    e.y = at.y;
    dx = player.x - e.x;
    dy = player.y - e.y;
    dist = Math.hypot(dx, dy) || 1;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  let vx = nx * e.speed;
  let vy = ny * e.speed;

  switch (e.def.ai) {
    case 'waver': {
      // Avanza serpenteando: difícil de alinear con armas rectas.
      const sway = Math.sin(w.time * 3 + e.uid) * 0.7;
      vx += -ny * e.speed * sway;
      vy += nx * e.speed * sway;
      break;
    }
    case 'charger':
      // 0 = se acerca · 1 = se detiene y avisa · 2 = embiste en línea recta.
      e.t2 -= dt;
      if (e.state === 0) {
        if (dist < 110 && e.t2 <= 0) {
          e.state = 1;
          e.t1 = 0.55;
        }
      } else if (e.state === 1) {
        vx = vy = 0;
        e.flash = 0.05;
        e.t1 -= dt;
        if (e.t1 <= 0) {
          e.state = 2;
          e.t1 = 0.5;
          e.vx = nx * e.speed * 4.5;
          e.vy = ny * e.speed * 4.5;
        }
      } else {
        vx = e.vx;
        vy = e.vy;
        e.t1 -= dt;
        if (e.t1 <= 0) {
          e.state = 0;
          e.t2 = 2;
        }
      }
      break;
    case 'shooter':
      // Mantiene la distancia y dispara espinas.
      if (dist < 90) {
        vx = -vx * 0.8;
        vy = -vy * 0.8;
      } else if (dist < 130) {
        vx = -ny * e.speed * 0.6;
        vy = nx * e.speed * 0.6;
      }
      e.t1 -= dt;
      if (e.t1 <= 0 && dist < 220) {
        e.t1 = 2.6;
        enemyShot(w, e.x, e.y, Math.atan2(dy, dx), 80, e.damage);
      }
      break;
    case 'volley':
      // Se mantiene lejos y dispara tres flechas en abanico.
      if (dist < 100) {
        vx = -vx * 0.7;
        vy = -vy * 0.7;
      } else if (dist < 140) {
        vx = -ny * e.speed * 0.5;
        vy = nx * e.speed * 0.5;
      }
      e.t1 -= dt;
      if (e.t1 <= 0 && dist < 230) {
        e.t1 = 3.2;
        const aim = Math.atan2(dy, dx);
        for (let i = -1; i <= 1; i++) enemyShot(w, e.x, e.y, aim + i * 0.22, 90, e.damage * 0.8, 'x_arrow');
      }
      break;
    case 'egg':
      // Si no se rompe a tiempo, eclosiona en esbirros del jefe (sin recompensa).
      vx = 0;
      vy = 0;
      e.t1 -= dt;
      if (e.t1 <= 0) {
        e.dead = true;
        const minion = ENEMY_BY_ID.get(w.enemies.find((x) => !x.dead && x.def.patterns)?.def.minion ?? 'bat');
        for (let i = 0; i < EGG_HATCH.minions && minion; i++) spawnEnemy(w, minion, e.x + (i % 2) * 8 - 4, e.y + (i < 2 ? -4 : 4));
        emit(w, { type: 'puff', x: e.x, y: e.y, color: 0xe8e0c8, count: 10 });
      }
      break;
    case 'reaper':
      e.t1 -= dt;
      if (dist < e.radius + PLAYER_RADIUS + 6) reaperStrike(w, e);
      break;
    case 'boss': {
      if (e.def.patterns) {
        const velocity = updateCycleBoss(w, e, dt, Math.atan2(dy, dx));
        if (velocity) [vx, vy] = velocity;
        break;
      }
      // Jefes de escenario: ráfaga radial cada 4 s e invocación de esbirros cada 9 s.
      e.t1 -= dt;
      e.t2 -= dt;
      if (e.t1 <= 0) {
        e.t1 = 4;
        const offset = rand(w) * Math.PI;
        for (let i = 0; i < 12; i++) enemyShot(w, e.x, e.y, offset + (i / 12) * Math.PI * 2, 70, e.damage * 0.5);
        emit(w, { type: 'ring', x: e.x, y: e.y, radius: e.radius + 8, color: 0xc9f27a });
      }
      if (e.t2 <= 0) {
        e.t2 = 9;
        const minion = ENEMY_BY_ID.get(e.def.minion ?? 'bones');
        if (minion && w.enemies.length < maxEnemies(w))
          for (let i = 0; i < 6; i++) spawnEnemy(w, minion, e.x + Math.cos(i) * 26, e.y + Math.sin(i) * 26);
      }
      break;
    }
    case 'chase':
      break;
  }

  // Retroceso de los golpes, que se amortigua enseguida.
  e.x += (vx + e.kx) * dt;
  e.y += (vy + e.ky) * dt;
  const decay = Math.exp(-9 * dt);
  e.kx *= decay;
  e.ky *= decay;

  if (dist < e.radius + PLAYER_RADIUS) hurtPlayer(w, e.damage);
}

/** Los enemigos se empujan entre sí para no apilarse en un solo punto. */
function separate(w: World) {
  for (const e of w.enemies) {
    if (e.dead || e.def.ai === 'boss' || e.def.ai === 'reaper') continue;
    const count = queryNear(e.x, e.y, e.radius * 0.6);
    for (let i = 0; i < count; i++) {
      const o = near[i];
      if (o === e) continue;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = ((e.radius + o.radius) * 0.8 - d) * 0.08;
      if (push > 0) {
        e.x += (dx / d) * push;
        e.y += (dy / d) * push;
      }
    }
  }
}

// ── Objetos del suelo ───────────────────────────────────────────────────────────────────────────

function gainXp(w: World, amount: number) {
  const p = w.player;
  p.xp += amount * p.stats.growth;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = xpForLevel(p.level);
    w.pendingLevels += 1;
  }
}

function updatePickups(w: World, dt: number) {
  const p = w.player;
  const reach = p.stats.pickup * p.stats.pickup;
  for (const item of w.pickups) {
    const dx = p.x - item.x;
    const dy = p.y - item.y;
    const d2 = dx * dx + dy * dy;
    if (!item.pulled && d2 < reach) item.pulled = true;
    if (!item.pulled) continue;
    const d = Math.sqrt(d2) || 1;
    if (d < 8) {
      item.dead = true;
      if (item.kind === 'xp') gainXp(w, item.value);
      else if (item.kind === 'coin') w.gold += item.value * p.stats.greed;
      else if (item.kind === 'heart') p.hp = Math.min(p.stats.maxHp, p.hp + item.value);
      else if (item.kind === 'chest') openChest(w);
      else for (const other of w.pickups) if (other.kind === 'xp') other.pulled = true; // imán
      continue;
    }
    const speed = Math.max(180, p.stats.moveSpeed * 2.5);
    item.x += (dx / d) * speed * dt;
    item.y += (dy / d) * speed * dt;
  }
}

/** Quita los elementos muertos sin crear arrays nuevos. */
function compact<T extends { dead: boolean }>(list: T[]) {
  let kept = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[kept++] = list[i];
  list.length = kept;
}

// ── Paso de simulación ──────────────────────────────────────────────────────────────────────────

/**
 * Avanza la partida `dt` segundos. (moveX, moveY) es la dirección del jugador con módulo ≤ 1.
 * No hace nada si la partida está detenida (subida de nivel pendiente, muerte o victoria).
 */
export function step(w: World, dt: number, moveX: number, moveY: number) {
  if (w.phase !== 'playing') return;
  w.time += dt;
  const p = w.player;

  const length = Math.hypot(moveX, moveY);
  p.moving = length > 0.05;
  if (p.moving) {
    const scale = length > 1 ? 1 / length : 1;
    // Telarañas y burbujas de tiempo de los jefes: mitad de velocidad.
    const slow = w.slowed ? 0.5 : 1;
    p.x += moveX * scale * p.stats.moveSpeed * slow * dt;
    p.y += moveY * scale * p.stats.moveSpeed * slow * dt;
    p.dirX = moveX / length;
    p.dirY = moveY / length;
  }
  p.hurtTimer -= dt;
  if (p.stats.regen > 0) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.regen * dt);

  updateSpawns(w, dt);
  rebuildGrid(w);
  for (const e of w.enemies) if (!e.dead) updateEnemy(w, e, dt);
  separate(w);
  updateWeapons(w, dt);
  updateProjectiles(w, dt);
  updateHazards(w);
  updatePickups(w, dt);
  compact(w.enemies);
  compact(w.projectiles);
  compact(w.pickups);

  if (p.hp <= 0 && (p.stats.revival ?? 0) > 0) revive(w);
  if (p.hp <= 0) {
    p.hp = 0;
    w.phase = 'dead';
    return;
  }
  // Minuto 30: llega La Muerte (salvo en el modo infinito). La partida sigue hasta que alcanza al jugador.
  if (!w.completed && w.config.mode !== 'infinite' && w.time >= RUN_SECONDS) spawnReaper(w);
  if (w.pendingLevels > 0) {
    w.choices = rollChoices(w);
    w.phase = 'levelup';
  }
}

/** Segundos de invulnerabilidad al revivir. */
const REVIVE_GRACE = 3;
const REVIVE_RADIUS = 160;

/** Revive con media vida, aparta a los enemigos cercanos y da unos segundos de invulnerabilidad. */
function revive(w: World) {
  const p = w.player;
  p.stats.revival -= 1;
  p.hp = p.stats.maxHp * 0.5;
  p.hurtTimer = REVIVE_GRACE;
  for (const e of w.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d >= REVIVE_RADIUS || d === 0) continue;
    e.x = p.x + (dx / d) * REVIVE_RADIUS;
    e.y = p.y + (dy / d) * REVIVE_RADIUS;
  }
  w.fx.push({ type: 'ring', x: p.x, y: p.y, radius: REVIVE_RADIUS, color: 0xffe08a }, { type: 'shake', power: 6 });
}

/** Elige una de las opciones de la subida de nivel y reanuda la partida (o abre la siguiente). */
export function chooseUpgrade(w: World, index: number) {
  if (w.phase !== 'levelup') return;
  const choice = w.choices[index];
  if (!choice) return;
  if (w.choices.some((c) => c.kind === 'purge')) w.purgeAt = undefined;
  w.pendingLevels -= 1;
  if (choice.kind === 'purge') {
    w.choices = [];
    w.phase = 'purge';
    return;
  }
  applyChoice(w, choice);
  continueLevelUps(w);
}

/** Tras elegir: más subidas pendientes o vuelta a la partida. */
function continueLevelUps(w: World) {
  if (w.pendingLevels > 0) {
    w.phase = 'levelup';
    w.choices = rollChoices(w);
  } else {
    w.choices = [];
    w.phase = 'playing';
  }
}

/**
 * Mejora de eliminar: quita las armas y pasivas elegidas (por su posición) y deja libres sus huecos. Sin red de
 * seguridad: se pueden quitar todas.
 */
export function purgeItems(w: World, weapons: number[], passives: number[]) {
  if (w.phase !== 'purge') return;
  const p = w.player;
  p.weapons = p.weapons.filter((_, i) => !weapons.includes(i));
  p.passives = p.passives.filter((_, i) => !passives.includes(i));
  recomputeStats(w);
  if (weapons.length + passives.length > 0) {
    emit(w, { type: 'ring', x: p.x, y: p.y, radius: 60, color: 0xb58cff });
    emit(w, { type: 'shake', power: 4 });
  }
  continueLevelUps(w);
}

/** ¿Ha llegado al minuto 30? En normal y reflejo llega La Muerte; en infinito la partida sigue. */
export const reachedEnd = (w: World) => ((w.config.mode ?? 'normal') === 'infinite' ? w.time >= RUN_SECONDS : !!w.completed);

/**
 * ¿Supera el nivel? En normal y en infinito: llegar al minuto 30 y, en los niveles de jefe, haberlo vencido. En
 * infinito la partida sigue después y termina al morir o al salir. El reflejo nunca hace avanzar de nivel.
 */
export const passed = (w: World) => (w.config.mode ?? 'normal') !== 'mirror' && reachedEnd(w) && (!w.config.cycleBoss || w.cycleBoss === 2);

export function runResult(w: World): RunResult {
  const bonus = survivalBonus(w.config, w.time, w.player.stats.greed);
  return {
    won: passed(w),
    completed: !!w.completed,
    mode: w.config.mode ?? 'normal',
    time: w.time,
    level: w.player.level,
    kills: w.kills,
    gold: Math.floor(w.gold) + bonus,
    survivalBonus: bonus,
    weapons: w.player.weapons.map((ws) => ({ id: ws.id, level: ws.level, dealt: ws.dealt })),
  };
}
