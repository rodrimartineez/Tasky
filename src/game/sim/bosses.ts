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
  cooldown: 4,
};

/** Vuelta de la rotación de la partida (0 = primera). */
const roundOf = (w: World) => w.config.cycleBoss?.round ?? 0;

/** Ataques del jefe en esta vuelta: los suyos y, desde la segunda, también los avanzados. */
export function patternsOf(e: Enemy, round: number): BossPattern[] {
  const base = e.def.patterns ?? [];
  return round >= 1 ? [...base, ...(e.def.advanced ?? [])] : base;
}

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

/** Contexto de un ataque: el mundo, el jefe y datos que casi todos necesitan. */
interface Ctx {
  w: World;
  e: Enemy;
  p: World['player'];
  round: number;
  /** Ángulo del jefe hacia el jugador en este paso. */
  toPlayer: number;
  color: number;
  /** Daño base de sus proyectiles y zonas. */
  dmg: number;
}

/**
 * Un ataque: `begin` prepara (avisos, zonas, invocaciones) y `tick` actúa cada paso mientras dura. `t` son los
 * segundos transcurridos; `tick` puede devolver la velocidad del jefe. Con `still` se queda quieto; si no, sigue
 * persiguiendo al jugador.
 */
interface Attack {
  duration: number;
  still?: boolean;
  begin?(c: Ctx): void;
  tick?(c: Ctx, t: number, dt: number): [number, number] | undefined;
}

/** `t` acaba de pasar por `when` en este paso. */
const at = (t: number, dt: number, when: number) => t >= when && t - dt < when;
/** `t` acaba de pasar por un múltiplo de `period` en este paso. */
const every = (t: number, dt: number, period: number) => Math.floor(t / period) > Math.floor((t - dt) / period);

const polar = (x: number, y: number, angle: number, d: number): [number, number] => [x + Math.cos(angle) * d, y + Math.sin(angle) * d];

function hazard(w: World, h: Hazard) {
  (w.hazards ??= []).push(h);
}

/** Zona que estalla una vez, `delay` segundos después. */
function blast(c: Ctx, x: number, y: number, radius: number, delay: number, mult = 2) {
  hazard(c.w, { x, y, radius, at: c.w.time + delay, damage: c.dmg * mult });
}

/** Zona que hace daño mientras dura, tras `delay` segundos de aviso. */
function zone(c: Ctx, x: number, y: number, radius: number, delay: number, lasts: number, mult = 1) {
  hazard(c.w, { kind: 'zone', x, y, radius, at: c.w.time + delay, until: c.w.time + delay + lasts, damage: c.dmg * mult, color: c.color });
}

/** Rayo de un punto a otro: aviso `delay` segundos y luego activo `lasts`. */
function segment(c: Ctx, x: number, y: number, x2: number, y2: number, delay: number, lasts: number, width = 8) {
  hazard(c.w, { kind: 'beam', x, y, x2, y2, at: c.w.time + delay, until: c.w.time + delay + lasts, radius: width, damage: c.dmg * 1.5, color: c.color });
}

/** Rayo desde el jefe en la dirección `angle`. */
function beam(c: Ctx, angle: number, delay: number, lasts: number, width = 8, length = 300) {
  const [x2, y2] = polar(c.e.x, c.e.y, angle, length);
  segment(c, c.e.x, c.e.y, x2, y2, delay, lasts, width);
}

function shoot(c: Ctx, angle: number, speed: number, sprite?: string, from: { x: number; y: number } = c.e) {
  enemyShot(c.w, from.x, from.y, angle, speed, c.dmg, sprite);
}

function ring(c: Ctx, count: number, speed: number, offset = rand(c.w) * Math.PI) {
  for (let i = 0; i < count; i++) shoot(c, offset + (i / count) * Math.PI * 2, speed);
}

function pulse(c: Ctx, radius = c.e.radius + 10) {
  emit(c.w, { type: 'ring', x: c.e.x, y: c.e.y, radius, color: c.color });
}

/** Un esbirro del jefe junto a (x, y), si hay sitio. */
function spawnMinion(c: Ctx, x: number, y: number) {
  const minion = ENEMY_BY_ID.get(c.e.def.minion ?? 'bones');
  if (minion && c.w.enemies.length < maxEnemies(c.w) + 20) spawnEnemy(c.w, minion, x, y);
}

/** Punto al azar a una distancia entre `min` y `max` del jugador. */
function aroundPlayer(c: Ctx, min: number, max: number): [number, number] {
  return polar(c.p.x, c.p.y, rand(c.w) * Math.PI * 2, min + rand(c.w) * (max - min));
}

/**
 * Los 40 ataques de los jefes de ciclo (HABITS_GUIDE §11). Cada jefe tiene los suyos (content/bosses.ts) y ninguno
 * se repite entre jefes: cada uno juega con una idea distinta.
 */
const ATTACKS: Record<BossPattern, Attack> = {
  // ── Guardián del Umbral: puertas, rejas y golpes de armadura ──
  portcullis: {
    // Reja de rayos paralelos: el jugador debe colarse por uno de los pasillos entre barrotes.
    duration: 0.5,
    begin(c) {
      const axis = rand(c.w) * Math.PI;
      const shift = (rand(c.w) - 0.5) * 44;
      for (let k = -4; k <= 4; k++) {
        const [x, y] = polar(c.p.x, c.p.y, axis + Math.PI / 2, k * 44 + shift);
        const [x1, y1] = polar(x, y, axis, -230);
        const [x2, y2] = polar(x, y, axis, 230);
        segment(c, x1, y1, x2, y2, 1.1, 0.6, 6);
      }
    },
  },
  cage: {
    // Corona alrededor del jugador: se salva quedándose en el centro (o huyendo lejos).
    duration: 1,
    begin(c) {
      hazard(c.w, { kind: 'ring', x: c.p.x, y: c.p.y, inner: 38, radius: 74, at: c.w.time + 0.9, damage: c.dmg * 2 });
      if (c.round >= 1) hazard(c.w, { kind: 'ring', x: c.p.x, y: c.p.y, inner: 100, radius: 130, at: c.w.time + 1.4, damage: c.dmg * 2 });
    },
  },
  slam: {
    // Martillazo a sus pies y, al caer, una onda de proyectiles.
    duration: 1.3,
    still: true,
    begin(c) {
      blast(c, c.e.x, c.e.y, 58, 0.8, 2.5);
      pulse(c, 58);
    },
    tick(c, t, dt) {
      if (at(t, dt, 0.8)) {
        ring(c, 12 + 2 * c.round, 70);
        emit(c.w, { type: 'shake', power: 5 });
      }
      return undefined;
    },
  },
  summon: {
    // Guardias: un círculo de esbirros a su alrededor.
    duration: 0.5,
    begin(c) {
      const count = 6 + 2 * c.round;
      for (let i = 0; i < count; i++) spawnMinion(c, ...polar(c.e.x, c.e.y, (i / count) * Math.PI * 2, 30));
      pulse(c, 34);
    },
  },

  // ── Madre de la Nidada: huevos, escupitajos y crías ──
  eggs: {
    duration: 0.6,
    begin(c) {
      const count = 3 + c.round;
      for (let i = 0; i < count; i++) {
        const [x, y] = aroundPlayer(c, 60, 130);
        spawnEnemy(c.w, EGG, x, y).t1 = EGG_HATCH.after;
      }
    },
  },
  spit: {
    // Chorro de ácido: una lluvia de escupitajos desordenados hacia el jugador.
    duration: 1.4,
    still: true,
    tick(c, t, dt) {
      if (t <= 1.2 && every(t, dt, 0.1)) shoot(c, c.toPlayer + (rand(c.w) - 0.5) * 0.7, 70 + rand(c.w) * 30);
      return undefined;
    },
  },
  brood: {
    // Cría un murciélago tras otro mientras gime.
    duration: 2.4,
    still: true,
    tick(c, t, dt) {
      if (t <= 2.1 && every(t, dt, 0.35)) {
        spawnMinion(c, ...polar(c.e.x, c.e.y, rand(c.w) * Math.PI * 2, 24));
        pulse(c, c.e.radius + 4);
      }
      return undefined;
    },
  },
  nest: {
    // Un nido de zonas ponzoñosas alrededor de ella: nadie se acerca.
    duration: 0.6,
    begin(c) {
      const offset = rand(c.w) * Math.PI;
      for (let i = 0; i < 6; i++) zone(c, ...polar(c.e.x, c.e.y, offset + (i / 6) * Math.PI * 2, 64), 24, 0.8, 6.5, 0.8);
    },
  },

  // ── Coloso de Piedra: terremotos y piedras ──
  quake: {
    // Ondas que se abren desde el jefe: hay que cruzarlas por el hueco entre una y otra o alejarse.
    duration: 1.8,
    still: true,
    begin(c) {
      const waves = 3 + Math.min(2, c.round);
      for (let i = 0; i < waves; i++) {
        const inner = 26 + i * 62;
        hazard(c.w, { kind: 'ring', x: c.e.x, y: c.e.y, inner, radius: inner + 26, at: c.w.time + 0.7 + i * 0.35, damage: c.dmg * 2 });
      }
      emit(c.w, { type: 'shake', power: 5 });
    },
  },
  stomp: {
    // Pisotones en cadena: una fila de golpes que avanza desde el jefe hacia el jugador.
    duration: 1.7,
    still: true,
    begin(c) {
      const count = 7 + Math.min(2, c.round);
      for (let i = 0; i < count; i++) blast(c, ...polar(c.e.x, c.e.y, c.toPlayer, 40 + i * 38), 30, 0.7 + i * 0.13);
    },
  },
  wall: {
    // Un anillo alrededor del jugador que se cierra, con un hueco por el que escapar.
    duration: 0.4,
    begin(c) {
      const count = 20;
      const gap = Math.floor(rand(c.w) * count);
      for (let i = 0; i < count; i++) {
        if (Math.abs(i - gap) <= 1 || Math.abs(i - gap) >= count - 1) continue;
        const a = (i / count) * Math.PI * 2;
        shoot(c, a + Math.PI, 40 + 4 * c.round, undefined, { x: c.p.x + Math.cos(a) * 210, y: c.p.y + Math.sin(a) * 210 });
      }
    },
  },
  fist: {
    // Puñetazo enorme sobre el jugador y, justo después, cuatro golpes donde suele esquivar.
    duration: 1.6,
    still: true,
    begin(c) {
      blast(c, c.p.x, c.p.y, 62, 1.1, 2.5);
      const offset = rand(c.w) * Math.PI;
      for (let i = 0; i < 4; i++) blast(c, ...polar(c.p.x, c.p.y, offset + (i * Math.PI) / 2, 105), 28, 1.5);
    },
  },

  // ── Mago de las Sombras: copias, saltos y magia ──
  clones: {
    duration: 0.6,
    begin(c) {
      const count = 2 + Math.min(2, c.round);
      const def = copyOf(c.e, 'clone');
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand(c.w);
        spawnEnemy(c.w, def, ...polar(c.e.x, c.e.y, a, 70)).t1 = 1 + i * 0.4;
      }
      pulse(c, 40);
    },
  },
  blink: {
    duration: 0.6,
    begin(c) {
      const angle = rand(c.w) * Math.PI * 2;
      [c.e.x, c.e.y] = polar(c.p.x, c.p.y, angle, 95);
      emit(c.w, { type: 'ring', x: c.e.x, y: c.e.y, radius: 30, color: c.color });
      ring(c, 6 + c.round, 50, angle);
    },
  },
  snipe: {
    // Tres descargas puntería: cada una apunta al jugador en el momento de disparar.
    duration: 1.7,
    still: true,
    tick(c, t, dt) {
      if (at(t, dt, 0.4) || at(t, dt, 0.9) || at(t, dt, 1.4))
        for (let i = -1; i <= 1; i++) shoot(c, c.toPlayer + i * 0.09, 100, 'x_arrow');
      return undefined;
    },
  },
  pentagram: {
    // Pentagrama sobre el jugador: cinco estallidos en las puntas y rayos entre ellas; el centro es seguro.
    duration: 0.6,
    begin(c) {
      const offset = rand(c.w) * Math.PI * 2;
      const tips = Array.from({ length: 5 }, (_, i) => polar(c.p.x, c.p.y, offset + (i / 5) * Math.PI * 2, 78));
      tips.forEach(([x, y], i) => {
        blast(c, x, y, 24, 1 + i * 0.1);
        const [x2, y2] = tips[(i + 2) % 5];
        segment(c, x, y, x2, y2, 1, 0.4, 5);
      });
    },
  },

  // ── Hidra del Pantano: cabezas, mordiscos y zambullidas ──
  heads: {
    duration: 0.6,
    begin(c) {
      const count = 2 + Math.min(2, c.round);
      const def = copyOf(c.e, 'head');
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand(c.w);
        spawnEnemy(c.w, def, ...polar(c.e.x, c.e.y, a, 70)).t1 = 1 + i * 0.4;
      }
      pulse(c, 40);
    },
  },
  lash: {
    // Tres latigazos de cuello seguidos, cada uno hacia donde está el jugador en ese instante.
    duration: 2,
    still: true,
    tick(c, t, dt) {
      if (at(t, dt, 0.1) || at(t, dt, 0.65) || at(t, dt, 1.2)) beam(c, c.toPlayer, 0.5, 0.25, 9, 270);
      return undefined;
    },
  },
  dive: {
    // Se sumerge y emerge sobre el punto marcado, aplastando lo que haya y soltando una onda.
    duration: 1.6,
    still: true,
    begin(c) {
      c.e.tx = c.p.x;
      c.e.ty = c.p.y;
      blast(c, c.p.x, c.p.y, 40, 1.1, 2.5);
    },
    tick(c, t, dt) {
      if (at(t, dt, 1.1)) {
        [c.e.x, c.e.y] = [c.e.tx ?? c.e.x, c.e.ty ?? c.e.y];
        ring(c, 8 + c.round, 60);
        pulse(c, 36);
        emit(c.w, { type: 'shake', power: 5 });
      }
      return undefined;
    },
  },
  fangs: {
    // Cinco colmillos en estrella: cada uno una hilera de proyectiles a distinta velocidad.
    duration: 0.6,
    begin(c) {
      const offset = rand(c.w) * Math.PI * 2;
      for (let arm = 0; arm < 5; arm++) for (const speed of [45, 62, 80]) shoot(c, offset + (arm / 5) * Math.PI * 2, speed, 'x_arrow');
      pulse(c);
    },
  },

  // ── Señor de la Plaga: charcos, contagio y miasma ──
  pools: {
    duration: 0.6,
    begin(c) {
      const count = 3 + 2 * c.round;
      for (let i = 0; i < count; i++) {
        const [x, y] = i === 0 ? [c.p.x, c.p.y] : aroundPlayer(c, 30, 120);
        zone(c, x, y, 28, 0.9, 5.1);
      }
    },
  },
  infect: {
    // Contagio: las ratas brotan alrededor del jugador, no del jefe.
    duration: 0.8,
    begin(c) {
      const count = 4 + c.round;
      const offset = rand(c.w) * Math.PI;
      for (let i = 0; i < count; i++) {
        const [x, y] = polar(c.p.x, c.p.y, offset + (i / count) * Math.PI * 2, 110);
        spawnMinion(c, x, y);
        emit(c.w, { type: 'puff', x, y, color: c.color, count: 6 });
      }
    },
  },
  miasma: {
    // Una nube enorme de plaga sobre sí mismo: obliga a mantener la distancia.
    duration: 1.4,
    begin(c) {
      zone(c, c.e.x, c.e.y, 85, 0.9, 5, 0.9);
      pulse(c, 85);
    },
  },
  spores: {
    // Dos coronas de esporas, una lenta y otra rápida, entrelazadas.
    duration: 0.6,
    begin(c) {
      const offset = rand(c.w) * Math.PI;
      ring(c, 12, 38, offset);
      ring(c, 12, 70, offset + Math.PI / 12);
      pulse(c);
    },
  },

  // ── Caballero Espectral: espadas y estocadas ──
  sweep: {
    // Un rayo gira media vuelta alrededor del jefe; se avisa la dirección de salida.
    duration: 3,
    still: true,
    begin(c) {
      const steps = 16;
      const dir = rand(c.w) < 0.5 ? -1 : 1;
      const start = c.toPlayer - dir * (Math.PI / 2);
      for (let i = 0; i < steps; i++) beam(c, start + dir * i * (Math.PI / steps) * (1 + 0.15 * c.round), 0.8 + i * 0.12, 0.2);
    },
  },
  lunge: {
    // Doble estocada: cada embestida se avisa con una línea y la segunda corrige el rumbo.
    duration: 2.2,
    begin(c) {
      c.e.aim = c.toPlayer;
      beam(c, c.toPlayer, 0.6, 0.3, 7, 270);
    },
    tick(c, t, dt) {
      if (at(t, dt, 1.1)) {
        c.e.aim = c.toPlayer;
        beam(c, c.toPlayer, 0.6, 0.3, 7, 270);
      }
      const dashing = (t >= 0.6 && t < 0.9) || (t >= 1.7 && t < 2);
      const aim = c.e.aim ?? 0;
      return dashing ? [Math.cos(aim) * 900, Math.sin(aim) * 900] : [0, 0];
    },
  },
  swords: {
    // Espadas fantasma que aparecen a su alrededor y convergen sobre el jugador.
    duration: 2,
    still: true,
    tick(c, t, dt) {
      if (t <= 0.18 * (6 + c.round) && every(t, dt, 0.18)) {
        const from = aroundPlayer(c, 150, 150);
        shoot(c, Math.atan2(c.p.y - from[1], c.p.x - from[0]), 120, 'x_arrow', { x: from[0], y: from[1] });
        emit(c.w, { type: 'puff', x: from[0], y: from[1], color: c.color, count: 4 });
      }
      return undefined;
    },
  },
  cross: {
    // Líneas que se cruzan justo donde está el jugador: hay que salir del cruce.
    duration: 0.6,
    begin(c) {
      const lines = 2 + Math.min(2, c.round);
      const offset = rand(c.w) * Math.PI;
      for (let i = 0; i < lines; i++) {
        const a = offset + (i / lines) * Math.PI;
        segment(c, ...polar(c.p.x, c.p.y, a, -320), ...polar(c.p.x, c.p.y, a, 320), 1, 0.5, 7);
      }
    },
  },

  // ── Fauces del Abismo: gravedad, vórtices y tentáculos ──
  gravity: {
    // Atrae al jugador hacia sus fauces mientras suelta anillos lentos.
    duration: 3,
    still: true,
    begin(c) {
      pulse(c, 120);
    },
    tick(c, t, dt) {
      const dx = c.e.x - c.p.x;
      const dy = c.e.y - c.p.y;
      const d = Math.hypot(dx, dy) || 1;
      const pull = (40 + 10 * c.round) * dt;
      c.p.x += (dx / d) * pull;
      c.p.y += (dy / d) * pull;
      if (every(t, dt, 0.5)) ring(c, 10 + 2 * c.round, 55);
      return undefined;
    },
  },
  spiral: {
    // Brazos de disparos que giran (más brazos en cada vuelta), una tanda cada 0,1 s.
    duration: 2.2,
    still: true,
    begin(c) {
      c.e.aim = rand(c.w) * Math.PI * 2;
    },
    tick(c, t, dt) {
      if (every(t, dt, 0.1)) {
        const arms = 2 + Math.min(3, c.round);
        for (let i = 0; i < arms; i++) shoot(c, (c.e.aim ?? 0) + (i / arms) * Math.PI * 2, 55);
        c.e.aim = (c.e.aim ?? 0) + 0.32;
      }
      return undefined;
    },
  },
  bite: {
    // Mordisco gigante: una zona enorme a su alrededor que se cierra de golpe y escupe una onda.
    duration: 1.8,
    still: true,
    begin(c) {
      blast(c, c.e.x, c.e.y, 125 + 10 * c.round, 1.3, 2.5);
      pulse(c, 125 + 10 * c.round);
    },
    tick(c, t, dt) {
      if (at(t, dt, 1.3)) {
        ring(c, 10, 45);
        emit(c.w, { type: 'shake', power: 6 });
      }
      return undefined;
    },
  },
  tentacles: {
    // Una estrella de rayos que gira un cuarto de vuelta barriendo el suelo.
    duration: 2.8,
    still: true,
    begin(c) {
      const arms = Math.min(6, 4 + c.round);
      const steps = 10;
      const dir = rand(c.w) < 0.5 ? -1 : 1;
      const offset = rand(c.w) * Math.PI * 2;
      for (let i = 0; i < steps; i++)
        for (let k = 0; k < arms; k++) beam(c, offset + (k / arms) * Math.PI * 2 + (dir * i * Math.PI) / 2 / steps, 0.8 + i * 0.15, 0.3, 7);
    },
  },

  // ── Tejedora del Tiempo: burbujas, relojes y ecos ──
  slow: {
    // Burbujas de tiempo: ralentizan mientras se pisan.
    duration: 0.5,
    begin(c) {
      const count = 3 + c.round;
      for (let i = 0; i < count; i++) {
        const [x, y] = i === 0 ? [c.p.x, c.p.y] : aroundPlayer(c, 40, 120);
        hazard(c.w, { kind: 'slow', x, y, radius: 40, at: c.w.time + 0.6, until: c.w.time + 7, damage: 0, color: c.color });
      }
    },
  },
  clockwork: {
    // Doce estallidos en círculo que se encienden como las horas de un reloj.
    duration: 3.4,
    begin(c) {
      const offset = rand(c.w) * Math.PI * 2;
      for (let i = 0; i < 12; i++) blast(c, ...polar(c.e.x, c.e.y, offset + (i / 12) * Math.PI * 2, 125), 26, 0.7 + i * 0.2);
    },
  },
  echo: {
    // Eco: cada 0,2 s marca donde está el jugador y estalla ahí poco después; castiga quedarse quieto.
    duration: 2.2,
    still: true,
    tick(c, t, dt) {
      if (t <= 2 && every(t, dt, 0.2)) blast(c, c.p.x, c.p.y, 24, 1.2);
      return undefined;
    },
  },
  rewind: {
    // Rebobina: tras dos segundos devuelve al jugador al punto donde estaba al empezar.
    duration: 2.2,
    still: true,
    begin(c) {
      c.e.tx = c.p.x;
      c.e.ty = c.p.y;
    },
    tick(c, t, dt) {
      const [x, y] = [c.e.tx ?? c.p.x, c.e.ty ?? c.p.y];
      if (every(t, dt, 0.3) && t < 2) emit(c.w, { type: 'ring', x, y, radius: 16, color: c.color });
      if (at(t, dt, 2)) {
        emit(c.w, { type: 'ring', x: c.p.x, y: c.p.y, radius: 20, color: c.color });
        [c.p.x, c.p.y] = [x, y];
        emit(c.w, { type: 'ring', x, y, radius: 26, color: c.color });
        emit(c.w, { type: 'shake', power: 4 });
      }
      return undefined;
    },
  },

  // ── Dragón del Eclipse: aliento, meteoros y fuego ──
  laser: {
    // Rayos avisados hacia el jugador y a sus lados; se disparan todos a la vez.
    duration: 1.5,
    still: true,
    begin(c) {
      const count = 3 + c.round;
      for (let i = 0; i < count; i++) beam(c, c.toPlayer + (i - (count - 1) / 2) * 0.45, 0.9, 0.5, 10, 340);
    },
  },
  meteors: {
    // Meteoros enormes que caen uno tras otro (el primero, justo encima del jugador).
    duration: 0.6,
    begin(c) {
      const count = Math.min(9, 5 + c.round);
      for (let i = 0; i < count; i++) {
        const [x, y] = i === 0 ? [c.p.x, c.p.y] : aroundPlayer(c, 25, 150);
        blast(c, x, y, 34, 0.9 + i * 0.22, 2.2);
      }
    },
  },
  flame: {
    // Llamarada: un chorro de fuego que barre de un lado a otro delante de él.
    duration: 2.2,
    still: true,
    tick(c, t, dt) {
      if (t <= 2 && every(t, dt, 0.07)) shoot(c, c.toPlayer + Math.sin(t * 2.6) * 0.8, 90);
      return undefined;
    },
  },
  embers: {
    // Rescoldos: fuegos que arden un buen rato repartidos alrededor del jugador.
    duration: 0.6,
    begin(c) {
      const count = Math.min(14, 8 + 2 * c.round);
      for (let i = 0; i < count; i++) zone(c, ...aroundPlayer(c, 30, 170), 26, 0.8, 5.5, 0.8);
    },
  },
};

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
  const attack = ATTACKS[patterns[(e.pattern ?? 0) % patterns.length]];
  const c: Ctx = { w, e, p: w.player, round, toPlayer, color: e.def.color ?? 0xffffff, dmg: e.damage * BOSS_TUNING.shot };

  if (e.state === 0) {
    e.t1 -= dt;
    if (e.t1 > 0) return null;
    e.state = 1;
    e.sub = attack.duration;
    attack.begin?.(c);
  }

  e.sub = (e.sub ?? 0) - dt;
  const velocity = attack.tick?.(c, attack.duration - e.sub, dt) ?? (attack.still ? ([0, 0] as [number, number]) : null);

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
