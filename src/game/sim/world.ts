import { ENEMY_BY_ID } from '../content/enemies';
import { emit, hurtPlayer, maxEnemies, near, queryNear, rand, rebuildGrid, ringPoint, spawnEnemy } from './core';
import { RUN_SECONDS, type Enemy, type RunConfig, type RunResult, type World } from './types';
import { applyChoice, newWeapon, openChest, rollChoices } from './upgrades';
import { enemyShot, updateProjectiles, updateWeapons } from './weapons';

/** Estado inicial de una partida. */
export function createWorld(config: RunConfig): World {
  return {
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
      weapons: [newWeapon(config.startingWeapon)],
      passives: [],
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

/** Experiencia necesaria para pasar del nivel `level` al siguiente. */
export const xpForLevel = (level: number) => 5 + (level - 1) * 5 + Math.floor(Math.pow(level - 1, 1.9) * 0.6);

// ── Aparición de enemigos ───────────────────────────────────────────────────────────────────────

function updateSpawns(w: World, dt: number) {
  const { stage } = w.config;
  const minute = w.time / 60;
  const cap = maxEnemies(w);
  for (let i = 0; i < stage.spawns.length; i++) {
    const rule = stage.spawns[i];
    if (minute < rule.from || minute >= rule.to) continue;
    const t = (minute - rule.from) / (rule.to - rule.from);
    w.spawnAcc[i] += (rule.rateStart + (rule.rateEnd - rule.rateStart) * t) * dt;
    const def = ENEMY_BY_ID.get(rule.enemy);
    while (w.spawnAcc[i] >= 1) {
      w.spawnAcc[i] -= 1;
      if (!def || w.enemies.length >= cap) continue; // con el mapa lleno la aparición se pierde
      const at = ringPoint(w);
      spawnEnemy(w, def, at.x, at.y);
    }
  }

  while (w.nextEvent < stage.events.length && stage.events[w.nextEvent].at <= w.time) {
    const event = stage.events[w.nextEvent++];
    const def = ENEMY_BY_ID.get(event.enemy);
    if (!def) continue;
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
    case 'boss':
      // Ráfaga radial cada 4 s e invocación de esbirros cada 9 s.
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
        const minion = ENEMY_BY_ID.get('bones');
        if (minion && w.enemies.length < maxEnemies(w)) for (let i = 0; i < 6; i++) spawnEnemy(w, minion, e.x + Math.cos(i) * 26, e.y + Math.sin(i) * 26);
      }
      break;
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
    if (e.dead || e.def.ai === 'boss') continue;
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
    p.x += moveX * scale * p.stats.moveSpeed * dt;
    p.y += moveY * scale * p.stats.moveSpeed * dt;
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
  updatePickups(w, dt);
  compact(w.enemies);
  compact(w.projectiles);
  compact(w.pickups);

  if (p.hp <= 0) {
    p.hp = 0;
    w.phase = 'dead';
  } else if (w.time >= RUN_SECONDS) {
    w.phase = 'won';
  } else if (w.pendingLevels > 0) {
    w.choices = rollChoices(w);
    w.phase = 'levelup';
  }
}

/** Elige una de las opciones de la subida de nivel y reanuda la partida (o abre la siguiente). */
export function chooseUpgrade(w: World, index: number) {
  if (w.phase !== 'levelup') return;
  const choice = w.choices[index];
  if (!choice) return;
  applyChoice(w, choice);
  w.pendingLevels -= 1;
  if (w.pendingLevels > 0) w.choices = rollChoices(w);
  else {
    w.choices = [];
    w.phase = 'playing';
  }
}

export function runResult(w: World): RunResult {
  return {
    won: w.phase === 'won',
    time: w.time,
    level: w.player.level,
    kills: w.kills,
    gold: Math.floor(w.gold),
    weapons: w.player.weapons.map((ws) => ({ id: ws.id, level: ws.level, dealt: ws.dealt })),
  };
}
