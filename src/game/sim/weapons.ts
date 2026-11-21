import { behaviourOf, hitFxOf, WEAPON_BY_ID } from '../content/weapons';
import { damageEnemy, emit, hasArcana, healPlayer, HOOKS, hurtPlayer, killEnemy, near, nearestEnemy, ON_HIT, queryNear, rand } from './core';
import { statsAt } from './upgrades';
import type { Enemy, ProjKind, Projectile, WeaponState, World } from './types';

/**
 * Comportamiento de cada arma (clave = id en content/weapons.ts) y movimiento de los proyectiles. La referencia
 * mecánica es la del género (Vampire Survivors): cada arma conserva su patrón de ataque, alcance y efectos.
 */

/** Media pantalla visible alrededor del jugador (render/renderer.ts: lado corto 260 px, apaisada ~16:9). */
const VIEW = { hw: 230, hh: 130 };

function spawnProjectile(w: World, kind: ProjKind, sprite: string, weapon: number, x: number, y: number): Projectile {
  const p: Projectile = {
    kind,
    sprite,
    weapon,
    x,
    y,
    vx: 0,
    vy: 0,
    damage: 0,
    radius: 4,
    life: 1,
    pierce: 1,
    knockback: 0,
    angle: 0,
    orbitR: 0,
    sx: x,
    sy: y,
    tx: x,
    ty: y,
    total: 1,
    hit: [],
    dead: false,
  };
  w.projectiles.push(p);
  return p;
}

/** Dispara `n` proyectiles (1 si el arma los suelta en ráfaga, uno tras otro). */
type Fire = (w: World, ws: WeaponState, index: number, n: number) => void;

/** Sprite del proyectil de un arma: el de su evolución si lo tiene, y si no el de siempre. */
const look = (ws: WeaponState, fallback: string) => WEAPON_BY_ID.get(ws.id)?.proj ?? fallback;
const tint = (ws: WeaponState, fallback: number) => WEAPON_BY_ID.get(ws.id)?.color ?? fallback;
const facing = (w: World) => Math.atan2(w.player.dirY, w.player.dirX);
/** Lado horizontal al que mira el jugador (1 derecha, −1 izquierda). */
const side = (w: World) => (w.player.dirX < 0 ? -1 : 1);

/** Efectos que no pueden ejecutarse mientras se recorre `near` (explosiones de críticos, charcos): al final del paso. */
const deferred: (() => void)[] = [];
function flush() {
  for (let i = 0; i < deferred.length; i++) deferred[i]();
  deferred.length = 0;
}

/** Ángulo hacia el enemigo más cercano en pantalla o, si no hay, hacia donde mira el jugador. */
function aimAngle(w: World, range = 150): number {
  const { player } = w;
  const target = nearestEnemy(w, player.x, player.y, range);
  return target ? Math.atan2(target.y - player.y, target.x - player.x) : facing(w);
}

/** Enemigos en pantalla (copia: se puede usar después de otras consultas). */
function onScreen(w: World): Enemy[] {
  const { player } = w;
  const count = queryNear(player.x, player.y, VIEW.hw + 20);
  const out: Enemy[] = [];
  for (let i = 0; i < count; i++) {
    const e = near[i];
    if (Math.abs(e.y - player.y) < VIEW.hh + 10 && e.def.ai !== 'reaper') out.push(e);
  }
  return out;
}

const pick = <T>(w: World, list: T[]): T | null => (list.length > 0 ? list[Math.floor(rand(w) * list.length)] : null);

/** Velocidad de proyectiles del jugador; con Caos en la noche oscura oscila entre −50 % y +50 % cada 10 s y gana un 1 % por nivel. */
function projSpeed(w: World): number {
  const { stats, level } = w.player;
  if (!hasArcana(w, 'chaos')) return stats.projSpeed;
  return stats.projSpeed * (1 + 0.5 * Math.sin((w.time * Math.PI * 2) / 10)) * (1 + 0.01 * (level - 1));
}

/** Proyectiles rectos: los únicos que rebotan (Vals de perlas, Voluntad azul de hierro). */
const BOUNCY = new Set<ProjKind>(['bolt', 'lance', 'spin']);

/** Proyectil con los valores habituales del arma (daño, tamaño, vida, perforación y retroceso). */
function shot(w: World, ws: WeaponState, index: number, kind: ProjKind, sprite: string, angle: number, speed = ws.stats.speed * projSpeed(w)) {
  const { player } = w;
  const p = spawnProjectile(w, kind, look(ws, sprite), index, player.x, player.y);
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.angle = angle;
  p.damage = ws.stats.damage;
  p.radius = ws.stats.area * player.stats.area;
  p.life = ws.stats.duration * player.stats.duration;
  p.pierce = ws.stats.pierce;
  p.knockback = ws.stats.knockback;
  if (BOUNCY.has(kind)) {
    const bounces = (hasArcana(w, 'waltz') ? 3 : 0) + (hasArcana(w, 'ironblue') ? 3 : 0);
    if (bounces > 0) p.bounces = bounces;
    if (hasArcana(w, 'ironblue')) p.pierce += 2;
  }
  return p;
}

/** Daño en círculo a todo lo que hay dentro. */
function blast(w: World, x: number, y: number, radius: number, damage: number, weapon: number, knockback: number, color: number, shake: number, secondary = false) {
  emit(w, { type: 'ring', x, y, radius, color });
  emit(w, { type: 'puff', x, y, color, count: 8 });
  if (shake) emit(w, { type: 'shake', power: shake });
  const count = queryNear(x, y, radius);
  const targets = near.slice(0, count);
  for (const e of targets) {
    const dx = e.x - x;
    const dy = e.y - y;
    const d = Math.hypot(dx, dy) || 1;
    damageEnemy(w, e, damage, weapon, (dx / d) * knockback, (dy / d) * knockback, secondary);
  }
}

/** Charco que daña cada `tick` segundos (Agua Bendita, formas del atún). */
function pool(w: World, weapon: number, sprite: string, x: number, y: number, radius: number, damage: number, life: number, tick: number, color: number) {
  const p = spawnProjectile(w, 'cloud', sprite, weapon, x, y);
  p.radius = radius;
  p.damage = damage;
  p.life = life;
  p.total = 0;
  p.vx = tick;
  p.color = color;
  return p;
}

/** Rayo o haz instantáneo: solo se dibuja (el daño lo hace quien lo lanza). */
function ray(w: World, weapon: number, x1: number, y1: number, x2: number, y2: number, width: number, color: number, life = 0.22, sprite = 'px') {
  const p = spawnProjectile(w, 'ray', sprite, weapon, x1, y1);
  p.tx = x2;
  p.ty = y2;
  p.radius = width;
  p.color = color;
  p.life = life;
  p.total = life;
}

const FREEZE_TOUGH = 0.3;
const freezeFor = (e: Enemy, seconds: number) => {
  const tough = e.elite || e.def.ai === 'boss';
  e.freeze = Math.max(e.freeze ?? 0, seconds * (tough ? FREEZE_TOUGH : 1));
};

// ── Armas ───────────────────────────────────────────────────────────────────────────────────────

/** Látigo: tajo horizontal hacia donde mira; los siguientes, al otro lado y algo más arriba. */
const whip: Fire = (w, ws, index, n) => {
  const { player } = w;
  const reach = ws.stats.area * player.stats.area;
  const dir = side(w);
  for (let i = 0; i < n; i++) {
    const sx = i % 2 === 0 ? dir : -dir;
    const lift = -Math.floor(i / 2) * 10 - (i % 2) * 5;
    const cx = player.x + sx * reach * 0.5;
    const cy = player.y + lift;
    const count = queryNear(cx, cy, reach * 0.6);
    for (let j = 0; j < count; j++) {
      const e = near[j];
      if (Math.abs(e.y - cy) > 12 + e.radius || Math.abs(e.x - cx) > reach * 0.55 + e.radius) continue;
      damageEnemy(w, e, ws.stats.damage, index, sx * ws.stats.knockback, 0);
    }
    const p = spawnProjectile(w, 'slash', look(ws, 'x_slash'), index, cx, cy);
    p.angle = sx > 0 ? 0 : Math.PI;
    p.radius = reach;
    p.life = ws.stats.duration;
    p.total = ws.stats.duration;
  }
};

/** Varita: cada proyectil, al enemigo más cercano. */
const wand: Fire = (w, ws, index, n) => {
  for (let i = 0; i < n; i++) shot(w, ws, index, 'bolt', 'x_spark', aimAngle(w) + (rand(w) - 0.5) * 0.08);
};

/** Cuchillo: hacia donde mira, con una ligera dispersión. */
const knife: Fire = (w, ws, index, n) => {
  const { player } = w;
  for (let i = 0; i < n; i++) {
    const angle = facing(w) + (rand(w) - 0.5) * 0.12;
    const p = shot(w, ws, index, 'lance', 'x_lance', angle);
    const off = (rand(w) - 0.5) * 10;
    p.x = player.x - Math.sin(angle) * off;
    p.y = player.y + Math.cos(angle) * off;
  }
};

const AXE_GRAVITY = 260;
/** Hacha: sale hacia arriba, abierta en abanico, y cae en parábola. */
const axe: Fire = (w, ws, index, n) => {
  for (let i = 0; i < n; i++) {
    ws.step = (ws.step ?? 0) + 1;
    const p = shot(w, ws, index, 'axe', 'x_axe', -Math.PI / 2);
    const k = ws.step % 4;
    p.vx = (k === 0 ? 10 : k === 1 ? -22 : k === 2 ? 34 : -46) * (w.player.dirX < 0 ? -1 : 1) + (rand(w) - 0.5) * 10;
  }
};

/** Espiral Letal: guadañas que salen girando y abriéndose en espiral en todas direcciones. */
const deathspiral: Fire = (w, ws, index, n) => {
  const base = rand(w) * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const p = shot(w, ws, index, 'spin', 'x_deathspiral', base + (i / n) * Math.PI * 2);
    p.orbitR = 1.1; // giro de la trayectoria (rad/s)
  }
};

/** Cruz: al enemigo más cercano; vuelve como un bumerán. */
const cross: Fire = (w, ws, index, n) => {
  const { player } = w;
  const speed = ws.stats.speed * projSpeed(w);
  for (let i = 0; i < n; i++) {
    const angle = aimAngle(w, 170) + (rand(w) - 0.5) * 0.3;
    const p = shot(w, ws, index, 'boomerang', 'x_boomerang', angle);
    p.orbitR = speed * 1.25; // velocidad de vuelta
    p.total = ws.stats.duration * player.stats.duration; // segundos de ida
    p.life = 6;
    p.pierce = 999;
  }
};

/** Biblia: libros que orbitan un tiempo; luego descansan. Ritos Impíos: no se acaban nunca. */
const bible: Fire = (w, ws, index, n) => {
  const { player } = w;
  const forever = ws.id === 'eclipse';
  if (forever) {
    const live = w.projectiles.filter((q) => q.kind === 'orbit' && q.weapon === index && !q.dead);
    if (live.length === n) return;
    for (const q of live) q.dead = true;
  }
  const life = forever ? 1e6 : ws.stats.duration * player.stats.duration;
  for (let i = 0; i < n; i++) {
    const p = spawnProjectile(w, 'orbit', look(ws, 'x_orb'), index, player.x, player.y);
    p.angle = (i / n) * Math.PI * 2;
    p.orbitR = ws.stats.area * player.stats.area;
    p.vx = ws.stats.speed * projSpeed(w);
    p.damage = ws.stats.damage;
    p.radius = 7 * Math.sqrt(player.stats.area);
    p.life = life;
    p.knockback = ws.stats.knockback;
  }
  if (!forever) ws.timer += life; // el descanso empieza cuando desaparecen
};

/** Varita Ígnea: bolas de fuego contra enemigos al azar (o en una dirección al azar). */
const firewand: Fire = (w, ws, index, n) => {
  const { player } = w;
  const targets = onScreen(w);
  for (let i = 0; i < n; i++) {
    const t = pick(w, targets);
    const angle = t ? Math.atan2(t.y - player.y, t.x - player.x) + (rand(w) - 0.5) * 0.15 : rand(w) * Math.PI * 2;
    shot(w, ws, index, 'bolt', 'x_fireball', angle);
  }
};

/** Ajo: daño periódico a todo lo que esté dentro del radio, apartándolo. */
const garlic: Fire = (w, ws, index) => {
  const { player } = w;
  const radius = emberRadius(w, ws);
  emit(w, { type: 'ring', x: player.x, y: player.y, radius, color: tint(ws, 0xffd0e0) });
  const count = queryNear(player.x, player.y, radius);
  for (let i = 0; i < count; i++) {
    const e = near[i];
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    damageEnemy(w, e, ws.stats.damage, index, (dx / d) * ws.stats.knockback, (dy / d) * ws.stats.knockback);
  }
};

export const emberRadius = (w: World, ws: WeaponState) => ws.stats.area * w.player.stats.area;

/** Agua Bendita: arroja un frasco a un punto al azar cerca del jugador; al romperse deja un charco. */
const holyWater: Fire = (w, ws, index, n) => {
  const { player } = w;
  for (let i = 0; i < n; i++) {
    const angle = rand(w) * Math.PI * 2;
    const dist = 20 + rand(w) * 60;
    const p = spawnProjectile(w, 'bomb', 'x_flask', index, player.x, player.y);
    p.tx = player.x + Math.cos(angle) * dist;
    p.ty = player.y + Math.sin(angle) * dist;
    p.total = 0.45;
    p.life = p.total;
    p.splash = ws.stats.area * player.stats.area;
    p.damage = ws.stats.damage;
  }
};

/** Runa Trazadora: sale en una dirección al azar y rebota en los bordes de la pantalla. */
const runetracer: Fire = (w, ws, index, n) => {
  for (let i = 0; i < n; i++) {
    const p = shot(w, ws, index, 'bounce', 'x_ricochet', rand(w) * Math.PI * 2);
    p.pierce = 999;
    p.radius += 3;
  }
};

/** Anillo Relámpago: rayos del cielo sobre enemigos al azar, con daño en un área pequeña. Tormenta: caen dos veces. */
const lightning: Fire = (w, ws, index, n) => {
  const { player } = w;
  const targets = onScreen(w);
  const strikes = ws.id === 'tempest' ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const t = pick(w, targets);
    if (!t) return;
    const x = t.x;
    const y = t.y;
    for (let k = 0; k < strikes; k++) {
      ray(w, index, x + (rand(w) - 0.5) * 24, y - 160, x, y, 2.5, tint(ws, 0xbfe8ff), 0.18);
      blast(w, x, y, ws.stats.area * player.stats.area, ws.stats.damage, index, 0, tint(ws, 0xbfe8ff), 0.6);
    }
  }
};

/**
 * Pentáculo: borra a los enemigos normales que hay en su radio (élites y jefes solo reciben su daño) y también la
 * experiencia del suelo. La Luna Preciosa, en cambio, la atrae toda hacia el jugador.
 */
const pentagram: Fire = (w, ws, index) => {
  const { player } = w;
  const radius = ws.stats.area * player.stats.area;
  const count = queryNear(player.x, player.y, radius);
  const targets = near.slice(0, count);
  for (const e of targets) {
    if (e.elite || e.def.ai === 'boss' || e.def.ai === 'reaper') damageEnemy(w, e, ws.stats.damage, index, 0, 0);
    else if (!e.dead) {
      // Borrado: cuenta como su daño nominal (no la vida que tuviera) para el resumen y el equilibrio.
      ws.dealt += ws.stats.damage;
      killEnemy(w, e);
    }
  }
  const gather = ws.id === 'fullmoon';
  for (const item of w.pickups) {
    if (item.kind !== 'xp' || (!gather && Math.hypot(item.x - player.x, item.y - player.y) > radius)) continue;
    if (gather) item.pulled = true;
    else item.dead = true;
  }
  emit(w, { type: 'ring', x: player.x, y: player.y, radius, color: tint(ws, 0xd9b8ff) });
  emit(w, { type: 'ring', x: player.x, y: player.y, radius: radius * 0.5, color: 0xffffff });
  emit(w, { type: 'shake', power: 4 });
};

/** Segundos entre golpes de una columna a un mismo enemigo. */
const COLUMN_TICK = 1;
/** Media altura de las columnas (algo más que la pantalla). */
export const COLUMN_HALF = 150;
/** Canción de Maná: una columna vertical que sigue al jugador (ignora los proyectiles extra). */
const songOfMana: Fire = (w, ws, index) => {
  const { player } = w;
  const p = spawnProjectile(w, 'column', look(ws, 'x_mana'), index, player.x, player.y);
  p.radius = ws.stats.area * player.stats.area;
  p.damage = ws.stats.damage;
  p.life = ws.stats.duration * player.stats.duration;
  p.total = 0;
};

/** Lanceta Temporal: un haz que congela, cada vez una hora más en la esfera. El Corredor, en cada vuelta, parte la vida. */
const clockLancet: Fire = (w, ws, index) => {
  const { player } = w;
  ws.step = ((ws.step ?? 0) + 1) % 12;
  const angle = -Math.PI / 2 + ws.step * (Math.PI / 6);
  const length = ws.stats.area * player.stats.area;
  const cx = Math.cos(angle);
  const cy = Math.sin(angle);
  const freeze = ws.stats.duration * player.stats.duration;
  const count = queryNear(player.x + cx * length * 0.5, player.y + cy * length * 0.5, length * 0.5 + 8);
  for (let i = 0; i < count; i++) {
    const e = near[i];
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const along = dx * cx + dy * cy;
    if (along < 0 || along > length || Math.abs(dx * cy - dy * cx) > 6 + e.radius) continue;
    freezeFor(e, freeze);
  }
  ray(w, index, player.x, player.y, player.x + cx * length, player.y + cy * length, 3, ws.id === 'eternal' ? 0xd8b8ff : 0x9ad8ff, 0.3);
  if (ws.id === 'eternal' && ws.step === 0) {
    // Cada vuelta completa: la vida de todo lo que hay en pantalla, a la mitad (jefes de ciclo y La Muerte aparte).
    for (const e of onScreen(w)) if (e.def.ai !== 'boss') e.hp = Math.max(1, e.hp / 2);
    emit(w, { type: 'ring', x: player.x, y: player.y, radius: VIEW.hw, color: 0xff7ac3 });
    emit(w, { type: 'ring', x: player.x, y: player.y, radius: VIEW.hw * 0.66, color: 0x7ee8e0 });
    emit(w, { type: 'ring', x: player.x, y: player.y, radius: VIEW.hw * 0.33, color: 0xf6c945 });
    emit(w, { type: 'shake', power: 3 });
  }
};

/** Laurel y Sudario: recarga las cargas del escudo (sim/core.ts hurtPlayer las gasta). */
const laurel: Fire = (w, ws) => {
  const { player } = w;
  if ((player.shield ?? 0) >= ws.stats.amount) return;
  player.shield = ws.stats.amount;
  emit(w, { type: 'ring', x: player.x, y: player.y, radius: 18, color: tint(ws, 0x9fe8a0) });
};

/** Daño extra de Viento Sacro por caminar sin parar: +8 por segundo, hasta 8 por nivel. */
const ventoBonus = (w: World, ws: WeaponState) => Math.min(8 * Math.min(ws.level, 8), (w.player.moveTime ?? 0) * 8);

/** Viento Sacro: tajos horizontales delante; el Vendaval añade un círculo de cortes alrededor. */
const vento: Fire = (w, ws, index, n) => {
  const { player } = w;
  const reach = ws.stats.area * player.stats.area;
  const dir = side(w);
  const damage = ws.stats.damage + ventoBonus(w, ws);
  for (let i = 0; i < n; i++) {
    ws.step = (ws.step ?? 0) + 1;
    const around = ws.id === 'galedance' && ws.step % 2 === 0;
    const angle = around ? (ws.step / 2) * 0.9 : dir > 0 ? 0 : Math.PI;
    const cx = player.x + Math.cos(angle) * reach * 0.45;
    const cy = player.y + Math.sin(angle) * reach * 0.45 + (around ? 0 : (rand(w) - 0.5) * 16);
    const r = reach * 0.42;
    const count = queryNear(cx, cy, r);
    for (let j = 0; j < count; j++) {
      const e = near[j];
      damageEnemy(w, e, damage, index, Math.cos(angle) * ws.stats.knockback, Math.sin(angle) * ws.stats.knockback);
    }
    const p = spawnProjectile(w, 'slash', look(ws, 'x_vento'), index, cx, cy);
    p.angle = angle + (rand(w) - 0.5) * 0.4;
    p.radius = reach * 0.8;
    p.life = 0.18;
    p.total = 0.18;
  }
};

/** Espada de la Victoria: tajos sobre los enemigos más cercanos; desde el nivel 8, cada cinco, un remate vertical. */
const victory: Fire = (w, ws, index, n) => {
  const { player } = w;
  const radius = ws.stats.area * player.stats.area;
  for (let i = 0; i < n; i++) {
    const close = onScreen(w)
      .map((e) => ({ e, d: Math.hypot(e.x - player.x, e.y - player.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);
    const t = pick(w, close)?.e;
    const x = t ? t.x : player.x + side(w) * 30;
    const y = t ? t.y : player.y;
    ws.step = (ws.step ?? 0) + 1;
    if (ws.level >= 8 && ws.step % 5 === 0) {
      // Remate: una franja vertical enorme sobre el objetivo.
      const count = queryNear(x, y, radius * 3);
      for (let j = 0; j < count; j++) {
        const e = near[j];
        if (Math.abs(e.x - x) < radius * 0.7 + e.radius && Math.abs(e.y - y) < radius * 3) damageEnemy(w, e, ws.stats.damage * 2, index, 0, -ws.stats.knockback);
      }
      const f = spawnProjectile(w, 'slash', 'x_finisher', index, x, y);
      f.angle = 0;
      f.radius = radius * 3;
      f.life = f.total = 0.3;
      emit(w, { type: 'shake', power: 2 });
      continue;
    }
    slashAt(w, ws, index, x, y, radius, rand(w) * Math.PI * 2);
  }
};

function slashAt(w: World, ws: WeaponState, index: number, x: number, y: number, radius: number, angle: number) {
  const count = queryNear(x, y, radius);
  for (let j = 0; j < count; j++) damageEnemy(w, near[j], ws.stats.damage, index, Math.cos(angle) * ws.stats.knockback, Math.sin(angle) * ws.stats.knockback);
  const p = spawnProjectile(w, 'slash', 'x_victory', index, x, y);
  p.angle = angle;
  p.radius = radius * 1.4;
  p.life = p.total = 0.2;
}

/** Contraataque de la Espada al recibir un golpe: seis tajos alrededor, como mucho cada 0,6 s. */
const RIPOSTE = { slashes: 6, every: 0.6 };
HOOKS.hurt = (w) => {
  const { player } = w;
  const index = player.weapons.findIndex((x) => x.id === 'victory');
  if (index < 0) return;
  const ws = player.weapons[index];
  if (w.time - (ws.comboT ?? -9) < RIPOSTE.every) return;
  ws.comboT = w.time;
  const radius = ws.stats.area * player.stats.area;
  deferred.push(() => {
    for (let k = 0; k < RIPOSTE.slashes; k++) {
      const a = (k / RIPOSTE.slashes) * Math.PI * 2;
      slashAt(w, ws, index, player.x + Math.cos(a) * radius, player.y + Math.sin(a) * radius, radius, a);
    }
  });
};

/** Críticos propios según el estado del arma: la Espada de la Victoria los gana en el nivel 8. */
HOOKS.crit = (w, weapon) => {
  const ws = w.player.weapons[weapon];
  return ws?.id === 'victory' && ws.level >= 8 ? 0.1 : 0;
};

/** Daño extra por cada 5000 muertes (Solución Única y Cenizas de Exizografía). */
const killBonus = (w: World) => Math.floor(w.kills / 5000);

/** Solución Única: una galaxia que arrasa la pantalla durante 10 s; mientras, el jugador es intocable. */
const soleSolution: Fire = (w, ws, index) => {
  const { player } = w;
  const life = ws.stats.duration;
  const p = spawnProjectile(w, 'galaxy', 'x_victory', index, player.x, player.y);
  p.damage = ws.stats.damage + killBonus(w);
  p.life = life;
  p.total = 0;
  p.vx = 0.1; // segundos entre golpes
  p.sx = life; // duración inicial: la usa el dibujo para el fogonazo de entrada y el aviso del final
  player.hurtTimer = Math.max(player.hurtTimer, life);
  // Entrada a lo grande: ondas que barren la pantalla y un temblor fuerte.
  emit(w, { type: 'ring', x: player.x, y: player.y, radius: 340, color: 0xffffff });
  emit(w, { type: 'ring', x: player.x, y: player.y, radius: 240, color: 0x8f7bff });
  emit(w, { type: 'ring', x: player.x, y: player.y, radius: 140, color: 0xff7ac3 });
  emit(w, { type: 'shake', power: 8 });
};

/** Llamas de Hechizografía: llamaradas en abanico hacia donde camina; las Cenizas, también hacia atrás. */
const misspell: Fire = (w, ws, index, n) => {
  for (let i = 0; i < n; i++) {
    ws.step = (ws.step ?? 0) + 1;
    const back = ws.id === 'muspell' && ws.step % 2 === 0;
    const angle = facing(w) + (back ? Math.PI : 0) + (rand(w) - 0.5) * 0.9;
    const p = shot(w, ws, index, 'flare', 'x_flare', angle, ws.stats.speed * projSpeed(w) * 2); // alcance ×2
    p.damage = ws.stats.damage + (ws.id === 'muspell' ? killBonus(w) : 0);
    p.orbitR = p.radius; // radio final de la llamarada
    p.total = p.life;
    p.pierce = 999;
  }
};

const PHASER_COLORS = [0xff5a4a, 0xf6c945, 0x6bc5ff, 0xff7ac3];
const PHOTON_COLORS = [0xff5a4a, 0xff9f3a, 0xf6c945, 0x5ee08a, 0x6bc5ff, 0xb58cff];
/**
 * Fasor: cada proyectil es una secuencia de cuatro haces horizontales (rojo, amarillo, azul y magenta) centrados en un
 * enemigo; el primero de cada secuencia busca uno lejano y es más grueso. La Tormenta de Fotones, en todos los
 * colores, y la suerte puede multiplicar sus disparos.
 */
const phaser: Fire = (w, ws, index) => {
  const { player } = w;
  const photon = ws.id === 'photonstorm';
  const beams = 4;
  const sequence = (ws.step ?? 0) % beams === 0 && photon && rand(w) < 0.1 * player.stats.luck ? 1 + Math.floor(rand(w) * 4) : 1;
  for (let k = 0; k < sequence; k++) {
    const i = (ws.step = (ws.step ?? 0) + 1) - 1;
    const first = i % beams === 0;
    const targets = onScreen(w);
    let t: Enemy | null = null;
    if (first) for (const e of targets) if (!t || Math.hypot(e.x - player.x, e.y - player.y) > Math.hypot(t.x - player.x, t.y - player.y)) t = e;
    t ??= pick(w, targets.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)).slice(0, 6));
    const y = t ? t.y : player.y + (rand(w) - 0.5) * VIEW.hh;
    const half = ws.stats.area * player.stats.area * (first ? 2 : 1);
    const count = queryNear(player.x, y, VIEW.hw + 10);
    for (let j = 0; j < count; j++) {
      const e = near[j];
      if (Math.abs(e.y - y) < half + e.radius && Math.abs(e.x - player.x) < VIEW.hw) damageEnemy(w, e, ws.stats.damage, index, 0, 0);
    }
    const colors = photon ? PHOTON_COLORS : PHASER_COLORS;
    ray(w, index, player.x - VIEW.hw, y, player.x + VIEW.hw, y, half, colors[i % colors.length], first ? 0.3 : 0.2);
  }
};

/** Combo de críticos del Rayo Sobrenatural: con cada resurrección disponible, más tope, más ventana y más rayos. */
const comboRules = (w: World) => {
  const r = Math.max(0, w.player.stats.revival ?? 0);
  return { cap: 100 * (1 + r), window: 0.5 * (1 + r), amount: Math.min(10, r) };
};

/** Rayo Sobrenatural: rayo verde al enemigo más cercano (Interrupción: desde el dragón, siempre crítico). */
const unearthly: Fire = (w, ws, index) => {
  const { player } = w;
  let fromX = player.x;
  let fromY = player.y;
  if (ws.id === 'spirit') {
    // El dragón vive mientras se lleve el arma.
    let dragon = w.projectiles.find((q) => q.kind === 'dragon' && q.weapon === index && !q.dead);
    if (!dragon) {
      dragon = spawnProjectile(w, 'dragon', 'x_dragon', index, player.x, player.y - 90);
      dragon.life = 1e6;
      dragon.vx = ws.stats.speed; // velocidad angular del ocho
    }
    fromX = dragon.x;
    fromY = dragon.y;
  }
  const t = nearestEnemy(w, player.x, player.y, 170);
  if (!t) return;
  const combo = w.time - (ws.comboT ?? -9) <= comboRules(w).window ? (ws.combo ?? 0) : 0;
  ray(w, index, fromX, fromY, t.x, t.y, 2, 0x5ee08a, 0.2);
  damageEnemy(w, t, ws.stats.damage + combo, index, 0, 0);
};

/** Un crítico del rayo: estalla alrededor del objetivo y suma +1 al combo si llega a tiempo. */
const unearthlyCrit = (w: World, e: Enemy, _dmg: number, weapon: number, crit: boolean) => {
  if (!crit) return;
  const ws = w.player.weapons[weapon];
  if (!ws) return;
  const rules = comboRules(w);
  ws.combo = w.time - (ws.comboT ?? -9) <= rules.window ? Math.min(rules.cap, (ws.combo ?? 0) + 1) : 1;
  ws.comboT = w.time;
  const { x, y } = e;
  const radius = ws.stats.area * w.player.stats.area;
  deferred.push(() => blast(w, x, y, radius, ws.stats.damage, weapon, ws.stats.knockback, 0x5ee08a, 0, true));
};

/** Munición: balas al más cercano (por delante si puede); sin nadie a tiro, las guarda y luego las suelta de golpe. */
const AMMO = { range: 150, stock: 60 };
const ammo: Fire = (w, ws, index, n) => {
  const { player } = w;
  const t = nearestEnemy(w, player.x, player.y, AMMO.range);
  if (!t) {
    ws.step = Math.min(AMMO.stock, (ws.step ?? 0) + n);
    return;
  }
  if (ws.step) {
    ws.burst = (ws.burst ?? 0) + ws.step;
    ws.step = 0;
  }
  for (let i = 0; i < n; i++) {
    const p = shot(w, ws, index, 'bolt', 'x_bullet', Math.atan2(t.y - player.y, t.x - player.x) + (rand(w) - 0.5) * 0.12);
    p.radius = Math.max(2, p.radius);
  }
};

/** Pistolastrofe: oleadas de pistolas desde la esquina superior hacia la que mira; rebotan por la pantalla. */
const GUNS_PER_BURST = 8;
const gunastrophe: Fire = (w, ws, index, n) => {
  const { player } = w;
  const sx = side(w);
  for (let b = 0; b < n; b++)
    for (let i = 0; i < GUNS_PER_BURST; i++) {
      const angle = Math.atan2(1, -sx) + (rand(w) - 0.5) * 1.1;
      const p = shot(w, ws, index, 'bounce', 'x_gun', angle);
      p.x = player.x + sx * (VIEW.hw - 10);
      p.y = player.y - VIEW.hh + 10;
      p.pierce = 999;
      p.radius = 6;
    }
};

// ── Atún Cambiante ──────────────────────────────────────────────────────────────────────────────

const BUBBLES = 0x9ad8ff;
/** Atún Exprés: al más cercano; al golpear estalla en un charco de burbujas. */
const tuna1: Fire = (w, ws, index, n) => {
  for (let i = 0; i < n; i++) {
    const p = shot(w, ws, index, 'bolt', 'x_tuna', aimAngle(w) + (rand(w) - 0.5) * 0.2);
    p.life = 1.6;
    p.radius = 6;
    p.splash = ws.stats.area * w.player.stats.area;
    p.total = ws.stats.duration * w.player.stats.duration; // vida del charco
  }
};

/** Atunado: un remolino que persigue a los enemigos y salta de uno a otro. */
const tuna2: Fire = (w, ws, index, n) => {
  for (let i = 0; i < n; i++) {
    const p = shot(w, ws, index, 'critter', 'x_tornado', rand(w) * Math.PI * 2);
    p.total = 0;
  }
};

/** Atún Saltarín: salta en diagonal desde abajo, rebota en los lados y se queda junto al jugador hasta acabar. */
const tuna3: Fire = (w, ws, index, n) => {
  const { player } = w;
  for (let i = 0; i < n; i++) {
    const from = -side(w); // desde el lado contrario al que mira
    const p = shot(w, ws, index, 'leap', 'x_tuna', -Math.PI / 2);
    p.x = player.x + from * (VIEW.hw - 30) * (0.5 + rand(w) * 0.5);
    p.y = player.y + VIEW.hh;
    p.vx = -from * ws.stats.speed * 0.45 * projSpeed(w);
    p.vy = -ws.stats.speed * 1.4 * projSpeed(w);
    p.radius = Math.max(8, p.radius);
    p.total = 0; // 0 = en el aire; 1 = anclado al jugador
    p.life += 2;
  }
};

/** Lluvia de Atunes: caen en diagonal desde arriba a la derecha y dejan charcos de burbujas. */
const tuna4: Fire = (w, ws, index, n) => {
  const { player } = w;
  for (let i = 0; i < n; i++) {
    const p = spawnProjectile(w, 'meteor', 'x_tuna', index, 0, 0);
    p.tx = player.x + (rand(w) - 0.3) * 160;
    p.ty = player.y + (rand(w) - 0.5) * 140;
    p.sx = p.tx + 120;
    p.sy = p.ty - 160;
    p.x = p.sx;
    p.y = p.sy;
    p.total = p.life = 0.55 + i * 0.05;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.splash = p.radius;
    p.orbitR = ws.stats.duration * player.stats.duration; // vida del charco
    p.knockback = ws.stats.knockback;
  }
};

/** Atún Colosal: un atún gigante cae dando una voltereta sobre el jugador y deja un gran charco. */
const tuna5: Fire = (w, ws, index, n) => {
  const { player } = w;
  for (let i = 0; i < n; i++) {
    const p = spawnProjectile(w, 'meteor', 'x_bigtuna', index, 0, 0);
    p.tx = player.x + (i === 0 ? 0 : (rand(w) - 0.5) * 120);
    p.ty = player.y + (i === 0 ? 0 : (rand(w) - 0.5) * 90);
    p.sx = p.tx;
    p.sy = p.ty - 170;
    p.x = p.sx;
    p.y = p.sy;
    p.total = p.life = 0.7;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.splash = p.radius;
    p.orbitR = ws.stats.duration * player.stats.duration;
    p.knockback = ws.stats.knockback;
  }
};

/** Atún Insuperable: atunes dorados que salen de detrás del jugador y cruzan la pantalla en horizontal. */
const tuna6: Fire = (w, ws, index, n) => {
  const { player } = w;
  const dir = side(w);
  for (let i = 0; i < n; i++) {
    const p = shot(w, ws, index, 'lance', 'x_goldtuna', dir > 0 ? 0 : Math.PI);
    p.x = player.x - dir * 50;
    p.y = player.y + (rand(w) - 0.5) * 70;
    p.pierce = 999;
    p.radius = Math.max(7, p.radius);
  }
};

const TUNA_FIRE: Record<string, Fire> = { tuna1, tuna2, tuna3, tuna4, tuna5, tuna6 };

/** Milagro: cada forma usada ataca con su propio ritmo; las mejoras heredadas se reparten entre todas. */
function miracle(w: World, ws: WeaponState, index: number, dt: number) {
  const forms = ws.forms ?? [];
  ws.timers ??= forms.map(() => 0.5);
  const share: Record<string, number> = {};
  for (const key in ws.carry) share[key] = (ws.carry[key as keyof typeof ws.carry] ?? 0) / Math.max(1, forms.length);
  forms.forEach((id, k) => {
    ws.timers![k] -= dt;
    if (ws.timers![k] > 0) return;
    const def = WEAPON_BY_ID.get(id)!;
    const stats = statsAt(def, def.levels.length + 1, share);
    ws.timers![k] += stats.cooldown * w.player.stats.cooldown;
    TUNA_FIRE[id]?.(w, { ...ws, id, stats }, index, stats.amount + w.player.stats.amount);
  });
}

// ── Efectos al golpear ──────────────────────────────────────────────────────────────────────────

const LIFESTEAL = 8;
ON_HIT.galewhip = (w, _e, _d, _i, crit) => crit && healPlayer(w, LIFESTEAL);
ON_HIT.galedance = (w, e, dmg, weapon, crit) => {
  if (!crit) return;
  healPlayer(w, LIFESTEAL);
  const { x, y } = e;
  deferred.push(() => blast(w, x, y, 16 * w.player.stats.area, dmg, weapon, 10, 0xff4f9a, 0, true));
};
ON_HIT.pyre = (w) => healPlayer(w, 0.4);
ON_HIT.cataract = (_w, e) => void (e.sap = Math.max(0.2, (e.sap ?? 1) * 0.95));
ON_HIT.unearthly = unearthlyCrit;
ON_HIT.spirit = unearthlyCrit;

/** Comportamiento por id: el de la propia arma o evolución si lo tiene; si no, el de su arma base. */
const FIRE: Record<string, Fire> = {
  whip,
  spark: wand,
  lance: knife,
  axe,
  deathspiral,
  boomerang: cross,
  orbs: bible,
  firewand,
  ember: garlic,
  cloud: holyWater,
  ricochet: runetracer,
  storm: lightning,
  pentagram,
  mana: songOfMana,
  clock: clockLancet,
  laurel,
  vento,
  victory,
  sole: soleSolution,
  misspell,
  phaser,
  unearthly,
  ammo,
  gunastrophe,
  ...TUNA_FIRE,
};

/** Armas que no usan los proyectiles extra del jugador. */
const OWN_AMOUNT = new Set(['mana', 'cataract', 'clock', 'eternal', 'laurel', 'thornmail', 'pentagram', 'fullmoon', 'sole', 'ember', 'pyre']);

/** Proyectiles de un disparo: los del arma, los del jugador y, en el Fasor, cuatro haces por cada uno. */
function amountOf(w: World, ws: WeaponState): number {
  if (OWN_AMOUNT.has(ws.id)) return ws.stats.amount;
  let n = ws.stats.amount + w.player.stats.amount;
  // Principio: el arma inicial y su evolución ganan 3 proyectiles en lugar de 1 (el +1 general ya está en las estadísticas).
  if (hasArcana(w, 'beginning') && (ws.id === w.config.startingWeapon || WEAPON_BY_ID.get(ws.id)?.evolvedFrom === w.config.startingWeapon)) n += 2;
  const behaviour = behaviourOf(ws.id);
  if (behaviour === 'phaser') n *= 4;
  if (behaviour === 'unearthly') n += comboRules(w).amount;
  return n;
}

export function updateWeapons(w: World, dt: number) {
  const weapons = w.player.weapons;
  for (let i = 0; i < weapons.length; i++) {
    const ws = weapons[i];
    if (ws.id === 'miracle') {
      miracle(w, ws, i, dt);
      continue;
    }
    const def = WEAPON_BY_ID.get(ws.id);
    const fire = FIRE[ws.id] ?? FIRE[behaviourOf(ws.id)];
    if (!def || !fire) continue;
    // Ráfaga en curso: un proyectil cada `interval` segundos.
    if (ws.burst && def.interval) {
      ws.burstT = (ws.burstT ?? 0) - dt;
      while (ws.burst > 0 && ws.burstT <= 0) {
        fire(w, ws, i, 1);
        ws.burst -= 1;
        ws.burstT += def.interval;
      }
    }
    // Viento Sacro ataca el doble de a menudo mientras se camina.
    let rate = behaviourOf(ws.id) === 'vento' && w.player.moving ? 2 : 1;
    // Princesa trágica: todas las armas se recargan un 50 % más rápido al moverse.
    if (w.player.moving && hasArcana(w, 'tragic')) rate *= 1.5;
    ws.timer -= dt * rate;
    if (ws.timer > 0) continue;
    ws.timer += ws.stats.cooldown * (ws.id === 'sole' ? 1 : w.player.stats.cooldown);
    const n = amountOf(w, ws);
    if (def.interval && n > 1) {
      fire(w, ws, i, 1);
      ws.burst = (ws.burst ?? 0) + n - 1;
      ws.burstT = def.interval;
    } else fire(w, ws, i, n);
    // Niebla de zafiro: a veces el arma vuelve a atacar casi al instante.
    if (hasArcana(w, 'sapphire') && rand(w) < 0.25) ws.timer = Math.min(ws.timer, 0.15);
  }
  flush();
}

/** Impacto animado del arma (familia de su elemento, content/weapons.ts). */
function hitFx(w: World, p: Projectile, x: number, y: number) {
  const id = w.player.weapons[p.weapon]?.id;
  const sprite = id && hitFxOf(id);
  if (sprite) emit(w, { type: 'hit', x, y, sprite });
}

/** Golpea a los enemigos que toca un proyectil; muere al agotar los que puede atravesar. */
function hitLine(w: World, p: Projectile) {
  const count = queryNear(p.x, p.y, p.radius);
  for (let i = 0; i < count && !p.dead; i++) {
    const e = near[i];
    if (p.hit.includes(e.uid)) continue;
    p.hit.push(e.uid);
    const speed = Math.hypot(p.vx, p.vy) || 1;
    damageEnemy(w, e, p.damage, p.weapon, (p.vx / speed) * p.knockback, (p.vy / speed) * p.knockback);
    hitFx(w, p, e.x, e.y);
    if (p.splash) {
      // Atún Exprés: estalla en burbujas al primer golpe.
      const { x, y, splash, damage, weapon, total } = p;
      deferred.push(() => pool(w, weapon, 'x_bubble', x, y, splash, damage * 0.5, Math.max(0.4, total + 0.3), 0.35, BUBBLES));
      p.splash = undefined;
    }
    if (p.bounces && bounceToNext(w, p)) p.pierce += 1; // el rebote no gasta la perforación
    if (p.hit.length >= p.pierce) p.dead = true;
  }
}

/** Desvía el proyectil hacia el enemigo más cercano que aún no ha golpeado. Devuelve si ha rebotado. */
function bounceToNext(w: World, p: Projectile): boolean {
  const prey = nearestEnemy(w, p.x, p.y, 220, p.hit);
  if (!prey) return false;
  const speed = Math.hypot(p.vx, p.vy) || 1;
  const angle = Math.atan2(prey.y - p.y, prey.x - p.x);
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.angle = angle;
  p.bounces = (p.bounces ?? 1) - 1;
  p.life = Math.max(p.life, 0.8);
  return true;
}

/** Rebota en los bordes de la pantalla (alrededor del jugador). Devuelve si ha rebotado. */
function bounceEdges(w: World, p: Projectile): boolean {
  const { player } = w;
  let bounced = false;
  if ((p.x < player.x - VIEW.hw && p.vx < 0) || (p.x > player.x + VIEW.hw && p.vx > 0)) {
    p.vx = -p.vx;
    bounced = true;
  }
  if ((p.y < player.y - VIEW.hh && p.vy < 0) || (p.y > player.y + VIEW.hh && p.vy > 0)) {
    p.vy = -p.vy;
    bounced = true;
  }
  return bounced;
}

const CLOUD_TICK = 0.5;
const BORRA = { speed: 10, growth: 3 };
const LEAP_GRAVITY = 230;
const TORNADO_TURN = 0.35;

export function updateProjectiles(w: World, dt: number) {
  const { player } = w;
  for (const p of w.projectiles) {
    p.life -= dt;
    switch (p.kind) {
      case 'bolt':
      case 'lance':
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        hitLine(w, p);
        break;
      case 'orbit': {
        p.angle += p.vx * dt;
        p.x = player.x + Math.cos(p.angle) * p.orbitR;
        p.y = player.y + Math.sin(p.angle) * p.orbitR;
        const count = queryNear(p.x, p.y, p.radius);
        for (let i = 0; i < count; i++) {
          const e = near[i];
          if (e.contactCd > 0) continue;
          e.contactCd = 0.45;
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          damageEnemy(w, e, p.damage, p.weapon, (dx / d) * p.knockback, (dy / d) * p.knockback);
          hitFx(w, p, e.x, e.y);
        }
        break;
      }
      case 'bomb': {
        // Frasco de Agua Bendita: vuela en arco y, al romperse, deja un charco.
        const t = 1 - Math.max(0, p.life) / p.total;
        p.x = p.sx + (p.tx - p.sx) * t;
        p.y = p.sy + (p.ty - p.sy) * t;
        if (p.life <= 0) {
          const ws = w.player.weapons[p.weapon];
          const { x, y, damage, weapon } = p;
          const radius = p.splash ?? p.radius;
          const life = ws ? ws.stats.duration * player.stats.duration : 2;
          deferred.push(() => pool(w, weapon, ws ? look(ws, 'x_cloud') : 'x_cloud', x, y, radius, damage, life, CLOUD_TICK, 0x6bc5ff));
          emit(w, { type: 'puff', x, y, color: 0xd8f0ff, count: 6 });
        }
        break;
      }
      case 'meteor': {
        const t = 1 - Math.max(0, p.life) / p.total;
        p.x = p.sx + (p.tx - p.sx) * t;
        p.y = p.sy + (p.ty - p.sy) * t;
        p.angle += dt * 9;
        if (p.life <= 0) {
          const { x, y, radius, damage, weapon, knockback, orbitR, splash } = p;
          deferred.push(() => {
            blast(w, x, y, radius, damage, weapon, knockback, BUBBLES, 1.5);
            if (splash) pool(w, weapon, 'x_bubble', x, y, splash, damage * 0.5, orbitR, 0.75, BUBBLES);
          });
        }
        break;
      }
      case 'boomerang': {
        p.total -= dt;
        if (p.total > 0) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        } else {
          // Vuelta: al girar vuelve a poder golpear a los mismos enemigos.
          if (p.tx === p.sx) {
            p.tx += 1;
            p.hit.length = 0;
          }
          const dx = player.x - p.x;
          const dy = player.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          p.vx = (dx / d) * p.orbitR;
          p.vy = (dy / d) * p.orbitR;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (d < 8) p.dead = true;
        }
        p.angle += dt * 14;
        hitLine(w, p);
        break;
      }
      case 'cloud': {
        if (weaponOf(w, p) === 'plague') {
          // Brebaje Santo: crece y se arrastra hacia el jugador.
          const dx = player.x - p.x;
          const dy = player.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > 6) {
            p.x += (dx / d) * BORRA.speed * dt;
            p.y += (dy / d) * BORRA.speed * dt;
          }
          p.radius += BORRA.growth * dt;
        }
        p.total -= dt;
        if (p.total > 0) break;
        p.total += p.vx || CLOUD_TICK;
        const count = queryNear(p.x, p.y, p.radius);
        for (let i = 0; i < count; i++) damageEnemy(w, near[i], p.damage, p.weapon, 0, 0);
        break;
      }
      case 'bounce': {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += dt * 12;
        if (bounceEdges(w, p)) {
          // Al rebotar puede volver a golpear a los mismos; Sin Futuro estalla en cada rebote.
          p.hit.length = 0;
          if (weaponOf(w, p) === 'luckyblades') {
            const { x, y, damage, weapon } = p;
            deferred.push(() => blast(w, x, y, 26 * player.stats.area, damage, weapon, 30, 0xff4f9a, 1, true));
          }
        }
        hitLine(w, p);
        if (p.life <= 0 && weaponOf(w, p) === 'luckyblades') {
          const { x, y, damage, weapon } = p;
          deferred.push(() => blast(w, x, y, 26 * player.stats.area, damage, weapon, 30, 0xff4f9a, 1, true));
        }
        break;
      }
      case 'axe':
        p.vy += AXE_GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += dt * 12;
        hitLine(w, p);
        break;
      case 'spin': {
        if (p.orbitR) {
          // Trayectoria en espiral: la velocidad gira poco a poco.
          const turn = p.orbitR * dt;
          const c = Math.cos(turn);
          const s = Math.sin(turn);
          const vx = p.vx * c - p.vy * s;
          p.vy = p.vx * s + p.vy * c;
          p.vx = vx;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += dt * 14;
        hitLine(w, p);
        break;
      }
      case 'critter': {
        // Remolino: persigue al enemigo más cercano y, tras golpear, salta al siguiente.
        p.total -= dt;
        if (p.total <= 0) {
          p.total = TORNADO_TURN;
          const speed = Math.hypot(p.vx, p.vy) || 1;
          const prey = nearestEnemy(w, p.x, p.y, 120, p.hit.slice(-3));
          const angle = prey ? Math.atan2(prey.y - p.y, prey.x - p.x) : rand(w) * Math.PI * 2;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const count = queryNear(p.x, p.y, p.radius);
        for (let i = 0; i < count; i++) {
          const e = near[i];
          if (e.contactCd > 0) continue;
          e.contactCd = 1;
          p.hit.push(e.uid);
          p.total = 0;
          damageEnemy(w, e, p.damage, p.weapon, 0, -p.knockback);
          hitFx(w, p, e.x, e.y);
        }
        break;
      }
      case 'column': {
        p.x = player.x;
        p.y = player.y;
        p.total -= dt;
        if (p.total > 0) break;
        p.total += COLUMN_TICK;
        const count = queryNear(p.x, p.y, COLUMN_HALF);
        for (let i = 0; i < count; i++) {
          const e = near[i];
          if (Math.abs(e.x - p.x) > p.radius + e.radius) continue;
          damageEnemy(w, e, p.damage, p.weapon, 0, 0);
        }
        break;
      }
      case 'flare': {
        // Llamarada: avanza frenando, crece y se apaga.
        const t = 1 - Math.max(0, p.life) / p.total;
        p.radius = p.orbitR * (0.5 + t);
        p.x += p.vx * dt * (1 - t * 0.6);
        p.y += p.vy * dt * (1 - t * 0.6);
        hitLine(w, p);
        break;
      }
      case 'leap': {
        if (p.total === 0) {
          p.vy += LEAP_GRAVITY * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if ((p.x < player.x - VIEW.hw && p.vx < 0) || (p.x > player.x + VIEW.hw && p.vx > 0)) {
            p.vx = -p.vx;
            p.hit.length = 0;
            emit(w, { type: 'puff', x: p.x, y: p.y, color: BUBBLES, count: 4 });
          }
          // Sin impulso hacia arriba: se queda junto al jugador hasta que acabe.
          if (p.vy >= 0) {
            p.total = 1;
            p.sx = p.x - player.x;
            p.sy = p.y - player.y;
            p.life = Math.min(p.life, 2);
          }
        } else {
          p.x = player.x + p.sx;
          p.y = player.y + p.sy;
          if (p.hit.length > 0 && rand(w) < dt * 2) p.hit.length = 0;
        }
        p.angle += dt * 6;
        hitLine(w, p);
        break;
      }
      case 'dragon': {
        // Vuela en ocho sobre el jugador.
        p.angle += p.vx * dt;
        p.x = player.x + Math.sin(p.angle) * 110;
        p.y = player.y - 85 + Math.sin(p.angle * 2) * 25;
        if (!w.player.weapons[p.weapon] || w.player.weapons[p.weapon].id !== 'spirit') p.dead = true;
        break;
      }
      case 'galaxy': {
        p.x = player.x;
        p.y = player.y;
        p.angle += dt * (p.life > 1 ? -2 : 3);
        p.total -= dt;
        if (p.total > 0) break;
        p.total += p.vx;
        for (const e of onScreen(w)) damageEnemy(w, e, p.damage, p.weapon, 0, 0);
        break;
      }
      case 'enemyShot': {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const r = p.radius + 5;
        if (dx * dx + dy * dy < r * r) {
          hurtPlayer(w, p.damage);
          p.dead = true;
        }
        break;
      }
    }
    if (p.life <= 0) p.dead = true;
  }
  flush();
}

/** Id del arma que lanzó un proyectil. */
const weaponOf = (w: World, p: Projectile) => w.player.weapons[p.weapon]?.id;

/** Disparo de un enemigo hacia un ángulo. */
export function enemyShot(w: World, x: number, y: number, angle: number, speed: number, damage: number, sprite = 'x_thorn') {
  const p = spawnProjectile(w, 'enemyShot', sprite, -1, x, y);
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.angle = angle;
  p.damage = damage;
  p.radius = 3;
  p.life = 4;
}

