import { behaviourOf, WEAPON_BY_ID } from '../content/weapons';
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

/** Sprite del proyectil de un arma: el de su evolución si lo tiene, y si no el de siempre. */
const look = (ws: WeaponState, fallback: string) => WEAPON_BY_ID.get(ws.id)?.proj ?? fallback;
const tint = (ws: WeaponState, fallback: number) => WEAPON_BY_ID.get(ws.id)?.color ?? fallback;

/** Ángulo hacia el enemigo más cercano en pantalla (la vista mide unos 260 px en su lado corto) o, si no hay, hacia donde mira el jugador. */
function aimAngle(w: World, range = 150): number {
  const { player } = w;
  const target = nearestEnemy(w, player.x, player.y, range);
  return target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.atan2(player.dirY, player.dirX);
}

/** Chispa errante: proyectiles hacia el enemigo más cercano, abiertos en abanico. */
const spark: Fire = (w, ws, index) => {
  const { player } = w;
  const aim = aimAngle(w);
  const count = ws.stats.amount + player.stats.amount;
  const speed = ws.stats.speed * player.stats.projSpeed;
  for (let i = 0; i < count; i++) {
    const angle = aim + (i - (count - 1) / 2) * 0.2;
    const p = spawnProjectile(w, 'bolt', look(ws, 'x_spark'), index, player.x, player.y);
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
    const p = spawnProjectile(w, 'lance', look(ws, 'x_lance'), index, player.x - Math.sin(angle) * offset, player.y + Math.cos(angle) * offset);
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
    const p = spawnProjectile(w, 'orbit', look(ws, 'x_orb'), index, player.x, player.y);
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
      emit(w, { type: 'line', x: fromX, y: fromY, x2: current.x, y2: current.y, color: tint(ws, 0xbfe8ff) });
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
    const p = spawnProjectile(w, 'bomb', look(ws, 'x_flask'), index, player.x, player.y);
    p.tx = target ? target.x : player.x + Math.cos(angle) * 70;
    p.ty = target ? target.y : player.y + Math.sin(angle) * 70;
    p.total = ws.stats.duration + i * 0.12;
    p.life = p.total;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.knockback = ws.stats.knockback;
  }
};

const WHIP_DIRS = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
/** Látigo: golpea al instante un sector delante del jugador; con más látigos también por detrás y a los lados. */
const whip: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const reach = ws.stats.area * player.stats.area;
  const facing = Math.atan2(player.dirY, player.dirX);
  for (let i = 0; i < count; i++) {
    const angle = facing + WHIP_DIRS[i % WHIP_DIRS.length];
    const cx = Math.cos(angle);
    const cy = Math.sin(angle);
    const found = queryNear(player.x, player.y, reach);
    for (let j = 0; j < found; j++) {
      const e = near[j];
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = Math.hypot(dx, dy) || 1;
      if ((dx * cx + dy * cy) / d < 0.3) continue; // fuera del sector (unos ±72°)
      damageEnemy(w, e, ws.stats.damage, index, (dx / d) * ws.stats.knockback, (dy / d) * ws.stats.knockback);
    }
    const p = spawnProjectile(w, 'slash', look(ws, 'x_slash'), index, player.x + cx * reach * 0.55, player.y + cy * reach * 0.55);
    p.angle = angle;
    p.radius = reach;
    p.life = ws.stats.duration;
    p.total = ws.stats.duration;
  }
};

/** Búmeran: sale hacia el enemigo más cercano, atraviesa todo y vuelve a la mano (golpea a la ida y a la vuelta). */
const boomerang: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const aim = aimAngle(w, 170);
  const speed = ws.stats.speed * player.stats.projSpeed;
  for (let i = 0; i < count; i++) {
    const angle = aim + (i - (count - 1) / 2) * 0.4;
    const p = spawnProjectile(w, 'boomerang', look(ws, 'x_boomerang'), index, player.x, player.y);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.orbitR = speed * 1.25; // velocidad de vuelta
    p.life = 6; // seguro: normalmente vuelve mucho antes
    p.total = ws.stats.duration * player.stats.duration; // segundos de ida
    p.pierce = 999;
    p.knockback = ws.stats.knockback;
  }
};

/** Segundos que tarda una mina en armarse. */
export const MINE_ARM = 0.5;
/** Minas: se sueltan alrededor del jugador y estallan cuando un enemigo pisa su zona. */
const mines: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  for (let i = 0; i < count; i++) {
    const angle = rand(w) * Math.PI * 2;
    const dist = 8 + rand(w) * 26;
    const p = spawnProjectile(w, 'mine', look(ws, 'x_mine'), index, player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist);
    p.life = ws.stats.duration * player.stats.duration;
    p.total = p.life;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.knockback = ws.stats.knockback;
  }
};

const BEAM_TICK = 0.12;
/** Haz prismático: rayos que giran alrededor del jugador un tiempo y luego descansan. */
const beam: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const life = ws.stats.duration * player.stats.duration;
  const base = rand(w) * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const p = spawnProjectile(w, 'beam', look(ws, 'x_beam'), index, player.x, player.y);
    p.angle = base + (i / count) * Math.PI * 2;
    p.vx = ws.stats.speed * player.stats.projSpeed; // velocidad angular
    p.orbitR = ws.stats.area * player.stats.area; // largo del haz
    p.radius = 5 * Math.sqrt(player.stats.area); // grosor
    p.damage = ws.stats.damage;
    p.life = life;
    p.total = 0;
    p.knockback = ws.stats.knockback;
  }
  ws.timer += life;
};

/** Lluvia de meteoritos: caen del cielo sobre enemigos al azar y explotan en un área grande. */
const meteors: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const found = queryNear(player.x, player.y, 170);
  scratch.length = 0;
  for (let i = 0; i < found; i++) scratch.push(near[i]);
  for (let i = 0; i < count; i++) {
    const target = scratch.length > 0 ? scratch[Math.floor(rand(w) * scratch.length)] : null;
    const angle = rand(w) * Math.PI * 2;
    const p = spawnProjectile(w, 'meteor', look(ws, 'x_meteor'), index, 0, 0);
    p.tx = target ? target.x : player.x + Math.cos(angle) * 80;
    p.ty = target ? target.y : player.y + Math.sin(angle) * 80;
    p.sx = p.tx - 40;
    p.sy = p.ty - 150;
    p.x = p.sx;
    p.y = p.sy;
    p.total = ws.stats.duration + i * 0.15;
    p.life = p.total;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.knockback = ws.stats.knockback;
  }
};

const CLOUD_TICK = 0.5;
/** Nube venenosa: se queda donde cae y daña a todo el que esté dentro cada medio segundo. */
const cloud: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const found = queryNear(player.x, player.y, 140);
  scratch.length = 0;
  for (let i = 0; i < found; i++) scratch.push(near[i]);
  for (let i = 0; i < count; i++) {
    const target = scratch.length > 0 ? scratch[Math.floor(rand(w) * scratch.length)] : null;
    const angle = rand(w) * Math.PI * 2;
    const x = target ? target.x : player.x + Math.cos(angle) * 40;
    const y = target ? target.y : player.y + Math.sin(angle) * 40;
    const p = spawnProjectile(w, 'cloud', look(ws, 'x_cloud'), index, x, y);
    p.life = ws.stats.duration * player.stats.duration;
    p.total = 0;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area;
    p.knockback = ws.stats.knockback;
  }
};

/** Onda de choque: pulso instantáneo alrededor del jugador que empuja con fuerza a todo lo cercano. */
const nova: Fire = (w, ws, index) => {
  const { player } = w;
  const radius = ws.stats.area * player.stats.area;
  const found = queryNear(player.x, player.y, radius);
  for (let i = 0; i < found; i++) {
    const e = near[i];
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    damageEnemy(w, e, ws.stats.damage, index, (dx / d) * ws.stats.knockback, (dy / d) * ws.stats.knockback);
  }
  emit(w, { type: 'ring', x: player.x, y: player.y, radius, color: tint(ws, 0x9fe8ff) });
  emit(w, { type: 'ring', x: player.x, y: player.y, radius: radius * 0.6, color: 0xffffff });
  emit(w, { type: 'shake', power: 1 });
};

const RICOCHET_RANGE = 120;
const aimed: number[] = [];
/** Cuchillas rebotantes: cada una vuela hacia un enemigo distinto y, al golpear, salta al más cercano que aún no ha tocado. */
const ricochet: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const speed = ws.stats.speed * player.stats.projSpeed;
  const facing = Math.atan2(player.dirY, player.dirX);
  aimed.length = 0;
  for (let i = 0; i < count; i++) {
    const target = nearestEnemy(w, player.x, player.y, 150, aimed);
    if (target) aimed.push(target.uid);
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : facing + (i - (count - 1) / 2) * 0.5;
    const p = spawnProjectile(w, 'ricochet', look(ws, 'x_ricochet'), index, player.x, player.y);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.damage = ws.stats.damage;
    p.radius = ws.stats.area * player.stats.area + 3;
    p.life = ws.stats.duration * player.stats.duration;
    p.pierce = ws.stats.pierce; // rebotes que le quedan
    p.knockback = ws.stats.knockback;
  }
};

const DRONE_SPIN = 1.7;
const DRONE_RANGE = 130;
const DRONE_BOLT_SPEED = 220;
/** Dron centinela: orbitan un tiempo alrededor del jugador, disparan al enemigo más cercano y luego descansan. */
const drone: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const life = ws.stats.duration * player.stats.duration;
  for (let i = 0; i < count; i++) {
    const p = spawnProjectile(w, 'drone', look(ws, 'x_drone'), index, player.x, player.y);
    p.angle = (i / count) * Math.PI * 2;
    p.orbitR = ws.stats.area * player.stats.area;
    p.vx = DRONE_SPIN; // velocidad angular
    p.vy = (1 / ws.stats.speed) * player.stats.cooldown; // segundos entre disparos
    p.total = 0.3 + i * 0.2; // cuenta atrás hasta el próximo disparo (escalonada)
    p.damage = ws.stats.damage;
    p.pierce = ws.stats.pierce; // enemigos que atraviesa cada disparo
    p.knockback = ws.stats.knockback;
    p.life = life;
  }
  ws.timer += life;
};

const FLAME_TICK = 0.4;
/** Estela de fuego: deja llamas donde pasa el jugador (sin apilarlas en el mismo sitio). */
const trail: Fire = (w, ws, index) => {
  const { player } = w;
  const count = ws.stats.amount + player.stats.amount;
  const radius = ws.stats.area * player.stats.area;
  for (let i = 0; i < count; i++) {
    // Las llamas extra se reparten a los lados de la trayectoria.
    const offset = (i - (count - 1) / 2) * radius * 1.2;
    const x = player.x - player.dirY * offset;
    const y = player.y + player.dirX * offset;
    const taken = w.projectiles.some((q) => q.kind === 'flame' && q.weapon === index && !q.dead && Math.abs(q.x - x) < radius * 0.5 && Math.abs(q.y - y) < radius * 0.5);
    if (taken) continue;
    const p = spawnProjectile(w, 'flame', look(ws, 'x_flame'), index, x, y);
    p.life = ws.stats.duration * player.stats.duration;
    p.total = 0.15;
    p.damage = ws.stats.damage;
    p.radius = radius;
  }
};

const FIRE: Record<string, Fire> = { spark, lance, orbs, ember, storm, flask, whip, boomerang, mines, beam, meteors, cloud, nova, ricochet, drone, trail };

export function updateWeapons(w: World, dt: number) {
  const weapons = w.player.weapons;
  for (let i = 0; i < weapons.length; i++) {
    const ws = weapons[i];
    ws.timer -= dt;
    if (ws.timer > 0) continue;
    ws.timer += ws.stats.cooldown * w.player.stats.cooldown;
    FIRE[behaviourOf(ws.id)]?.(w, ws, i);
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

function explode(w: World, p: Projectile, color = 0xffb347, shake = 1.5) {
  emit(w, { type: 'ring', x: p.x, y: p.y, radius: p.radius, color });
  emit(w, { type: 'puff', x: p.x, y: p.y, color: 0xffd98a, count: 8 });
  emit(w, { type: 'shake', power: shake });
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
      case 'meteor': {
        const t = 1 - Math.max(0, p.life) / p.total;
        p.x = p.sx + (p.tx - p.sx) * t;
        p.y = p.sy + (p.ty - p.sy) * t;
        if (p.life <= 0) explode(w, p, 0xff7a3c, 2.5);
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
      case 'mine': {
        if (p.total - p.life < MINE_ARM) break;
        if (queryNear(p.x, p.y, 10) > 0) {
          explode(w, p, 0xffe08a, 1);
          p.dead = true;
        }
        break;
      }
      case 'beam': {
        p.angle += p.vx * dt;
        p.x = player.x;
        p.y = player.y;
        p.total -= dt;
        if (p.total > 0) break;
        p.total += BEAM_TICK;
        const cx = Math.cos(p.angle);
        const cy = Math.sin(p.angle);
        const count = queryNear(p.x + cx * p.orbitR * 0.5, p.y + cy * p.orbitR * 0.5, p.orbitR * 0.5);
        for (let i = 0; i < count; i++) {
          const e = near[i];
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const along = dx * cx + dy * cy;
          if (along < 0 || along > p.orbitR + e.radius || Math.abs(dx * cy - dy * cx) > p.radius + e.radius) continue;
          const d = Math.hypot(dx, dy) || 1;
          damageEnemy(w, e, p.damage, p.weapon, (dx / d) * p.knockback, (dy / d) * p.knockback);
        }
        break;
      }
      case 'cloud': {
        p.total -= dt;
        if (p.total > 0) break;
        p.total += CLOUD_TICK;
        const count = queryNear(p.x, p.y, p.radius);
        for (let i = 0; i < count; i++) damageEnemy(w, near[i], p.damage, p.weapon, 0, 0);
        break;
      }
      case 'ricochet': {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += dt * 18;
        const count = queryNear(p.x, p.y, p.radius);
        for (let i = 0; i < count; i++) {
          const e = near[i];
          if (p.hit.includes(e.uid)) continue;
          p.hit.push(e.uid);
          const speed = Math.hypot(p.vx, p.vy) || 1;
          damageEnemy(w, e, p.damage, p.weapon, (p.vx / speed) * p.knockback, (p.vy / speed) * p.knockback);
          // Rebota hacia el enemigo más cercano que aún no ha golpeado; sin rebotes o sin enemigos, se acaba.
          const next = p.pierce-- > 0 ? nearestEnemy(w, e.x, e.y, RICOCHET_RANGE, p.hit) : null;
          if (!next) {
            p.dead = true;
            break;
          }
          const d = Math.hypot(next.x - e.x, next.y - e.y) || 1;
          p.vx = ((next.x - e.x) / d) * speed;
          p.vy = ((next.y - e.y) / d) * speed;
          break;
        }
        break;
      }
      case 'drone': {
        p.angle += p.vx * dt;
        p.x = player.x + Math.cos(p.angle) * p.orbitR;
        p.y = player.y + Math.sin(p.angle) * p.orbitR;
        p.total -= dt;
        if (p.total > 0) break;
        const target = nearestEnemy(w, p.x, p.y, DRONE_RANGE);
        if (!target) {
          p.total = 0.1; // sin objetivo, vuelve a mirar enseguida
          break;
        }
        p.total += p.vy;
        const aim = Math.atan2(target.y - p.y, target.x - p.x);
        const shot = spawnProjectile(w, 'bolt', `${p.sprite}bolt`, p.weapon, p.x, p.y);
        shot.vx = Math.cos(aim) * DRONE_BOLT_SPEED * player.stats.projSpeed;
        shot.vy = Math.sin(aim) * DRONE_BOLT_SPEED * player.stats.projSpeed;
        shot.angle = aim;
        shot.damage = p.damage;
        shot.radius = 4;
        shot.life = 0.9;
        shot.pierce = p.pierce;
        shot.knockback = p.knockback;
        break;
      }
      case 'flame': {
        p.total -= dt;
        if (p.total > 0) break;
        p.total += FLAME_TICK;
        const count = queryNear(p.x, p.y, p.radius);
        for (let i = 0; i < count; i++) damageEnemy(w, near[i], p.damage, p.weapon, 0, 0);
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
export function enemyShot(w: World, x: number, y: number, angle: number, speed: number, damage: number, sprite = 'x_thorn') {
  const p = spawnProjectile(w, 'enemyShot', sprite, -1, x, y);
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.angle = angle;
  p.damage = damage;
  p.radius = 3;
  p.life = 4;
}
