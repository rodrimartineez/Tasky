import { damageEnemy, emit, hurtPlayer, near, nearestEnemy, queryNear, rand } from './core';
import type { Enemy, ProjKind, Projectile, WeaponState, World } from './types';

/** Comportamiento de cada arma (clave = id en content/weapons.ts) y movimiento de los proyectiles. */

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

type Fire = (w: World, ws: WeaponState, index: number) => void;

/** Chispa errante: proyectiles hacia el enemigo más cercano, abiertos en abanico. */
const spark: Fire = (w, ws, index) => {
  const { player } = w;
  // Solo apunta a lo que ya está en pantalla (la vista mide unos 260 px en su lado corto).
  const target = nearestEnemy(w, player.x, player.y, 150);
  const aim = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.atan2(player.dirY, player.dirX);
  const count = ws.stats.amount + player.stats.amount;
  const speed = ws.stats.speed * player.stats.projSpeed;
  for (let i = 0; i < count; i++) {
    const angle = aim + (i - (count - 1) / 2) * 0.2;
    const p = spawnProjectile(w, 'bolt', 'x_spark', index, player.x, player.y);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.angle = angle;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.life = ws.stats.duration * player.stats.duration;
    p.pierce = ws.stats.pierce;
    p.knockback = ws.stats.knockback;
  }
};

/** Lanza solar: recta en la dirección en la que mira el jugador; atraviesa a todos. */
const lance: Fire = (w, ws, index) => {
  const { player } = w;
  const angle = Math.atan2(player.dirY, player.dirX);
  const count = ws.stats.amount + player.stats.amount;
  const speed = ws.stats.speed * player.stats.projSpeed;
  for (let i = 0; i < count; i++) {
    // Varias lanzas salen en paralelo, separadas en perpendicular.
    const offset = (i - (count - 1) / 2) * 12;
    const p = spawnProjectile(w, 'lance', 'x_lance', index, player.x - Math.sin(angle) * offset, player.y + Math.cos(angle) * offset);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.angle = angle;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.life = ws.stats.duration * player.stats.duration;
    p.pierce = ws.stats.pierce;
    p.knockback = ws.stats.knockback;
  }
};

/** Lunas guardianas: orbitan un tiempo alrededor del jugador y luego descansan. */
const orbs: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const life = ws.stats.duration * player.stats.duration;
  for (let i = 0; i < count; i++) {
    const p = spawnProjectile(w, 'orbit', 'x_orb', index, player.x, player.y);
    p.angle = (i / count) * Math.PI * 2;
    p.orbitR = ws.stats.area * player.stats.area;
    p.vx = ws.stats.speed * player.stats.projSpeed; // velocidad angular
    p.damage = ws.stats.damage;
    p.radius = 6;
    p.life = life;
    p.knockback = ws.stats.knockback;
  }
  ws.timer += life; // el descanso empieza cuando desaparecen
};

/** Aura de ascuas: daño periódico a todo lo que esté dentro del radio. */
const ember: Fire = (w, ws, index) => {
  const { player } = w;
  const count = queryNear(player.x, player.y, emberRadius(w, ws));
  for (let i = 0; i < count; i++) {
    const e = near[i];
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    damageEnemy(w, e, ws.stats.damage, index, (dx / d) * ws.stats.knockback, (dy / d) * ws.stats.knockback);
  }
};

export const emberRadius = (w: World, ws: WeaponState) => ws.stats.area * w.player.stats.area;

const CHAIN_RANGE = 70;
const scratch: Enemy[] = [];

/** Tormenta en cadena: rayo instantáneo sobre un enemigo al azar que salta a los cercanos. */
const storm: Fire = (w, ws, index) => {
  const { player } = w;
  const bolts = ws.stats.amount + player.stats.amount;
  const range = ws.stats.area * player.stats.area;
  for (let b = 0; b < bolts; b++) {
    const count = queryNear(player.x, player.y, range);
    if (count === 0) return;
    let current: Enemy | null = near[Math.floor(rand(w) * count)];
    let fromX = current.x + (rand(w) - 0.5) * 30;
    let fromY = current.y - 140; // cae del cielo
    const hit: number[] = [];
    for (let jump = 0; jump <= ws.stats.pierce && current; jump++) {
      emit(w, { type: 'line', x: fromX, y: fromY, x2: current.x, y2: current.y, color: 0xbfe8ff });
      hit.push(current.uid);
      fromX = current.x;
      fromY = current.y;
      damageEnemy(w, current, ws.stats.damage, index, 0, 0);
      current = nearestEnemy(w, fromX, fromY, CHAIN_RANGE, hit);
    }
  }
};

/** Frasco volátil: vuela en arco hasta un grupo de enemigos y explota en área. */
const flask: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const found = queryNear(player.x, player.y, 150);
  scratch.length = 0;
  for (let i = 0; i < found; i++) scratch.push(near[i]);
  for (let i = 0; i < count; i++) {
    const target = scratch.length > 0 ? scratch[Math.floor(rand(w) * scratch.length)] : null;
    const angle = rand(w) * Math.PI * 2;
    const p = spawnProjectile(w, 'bomb', 'x_flask', index, player.x, player.y);
    p.tx = target ? target.x : player.x + Math.cos(angle) * 70;
    p.ty = target ? target.y : player.y + Math.sin(angle) * 70;
    p.total = ws.stats.duration + i * 0.12;
    p.life = p.total;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.knockback = ws.stats.knockback;
  }
};

const FIRE: Record<string, Fire> = { spark, lance, orbs, ember, storm, flask };

export function updateWeapons(w: World, dt: number) {
  const weapons = w.player.weapons;
  for (let i = 0; i < weapons.length; i++) {
    const ws = weapons[i];
    ws.timer -= dt;
    if (ws.timer > 0) continue;
    ws.timer += ws.stats.cooldown * w.player.stats.cooldown;
    FIRE[ws.id]?.(w, ws, i);
  }
}

/** Golpea a los enemigos que toca un proyectil recto; muere al agotar los que puede atravesar. */
function hitLine(w: World, p: Projectile) {
  const count = queryNear(p.x, p.y, p.radius);
  for (let i = 0; i < count && !p.dead; i++) {
    const e = near[i];
    if (p.hit.includes(e.uid)) continue;
    p.hit.push(e.uid);
    const speed = Math.hypot(p.vx, p.vy) || 1;
    damageEnemy(w, e, p.damage, p.weapon, (p.vx / speed) * p.knockback, (p.vy / speed) * p.knockback);
    if (p.hit.length >= p.pierce) p.dead = true;
  }
}

function explode(w: World, p: Projectile) {
  emit(w, { type: 'ring', x: p.x, y: p.y, radius: p.radius, color: 0xffb347 });
  emit(w, { type: 'puff', x: p.x, y: p.y, color: 0xffd98a, count: 8 });
  emit(w, { type: 'shake', power: 1.5 });
  const count = queryNear(p.x, p.y, p.radius);
  for (let i = 0; i < count; i++) {
    const e = near[i];
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    damageEnemy(w, e, p.damage, p.weapon, (dx / d) * p.knockback, (dy / d) * p.knockback);
  }
}

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
        }
        break;
      }
      case 'bomb': {
        const t = 1 - Math.max(0, p.life) / p.total;
        p.x = p.sx + (p.tx - p.sx) * t;
        p.y = p.sy + (p.ty - p.sy) * t;
        if (p.life <= 0) explode(w, p);
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
}

/** Disparo de un enemigo hacia un ángulo. */
export function enemyShot(w: World, x: number, y: number, angle: number, speed: number, damage: number) {
  const p = spawnProjectile(w, 'enemyShot', 'x_thorn', -1, x, y);
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.angle = angle;
  p.damage = damage;
  p.radius = 3;
  p.life = 4;
}
