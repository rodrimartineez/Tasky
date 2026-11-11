import type { SpawnRule, StageDef, StageEvent } from '../sim/types';

const MIN = 60;

/** Un enemigo de élite (con cofre) cada 90 s; el tipo cambia con el avance de la partida (tramos: <6, <14, <22 min y el resto). */
function elites(types: [string, string, string, string]): StageEvent[] {
  const out: StageEvent[] = [];
  for (let at = 90; at < 30 * MIN; at += 90) {
    const enemy = at < 6 * MIN ? types[0] : at < 14 * MIN ? types[1] : at < 22 * MIN ? types[2] : types[3];
    out.push({ at, kind: 'elite', enemy, count: 1 });
  }
  return out;
}

/** Atajos para escribir las tablas de aparición y de eventos (minutos de partida). */
const spawn = (enemy: string, from: number, to: number, rateStart: number, rateEnd: number): SpawnRule => ({ enemy, from, to, rateStart, rateEnd });
const ring = (minute: number, enemy: string, count: number): StageEvent => ({ at: minute * MIN, kind: 'ring', enemy, count });
/** Jefe a los 10 y 20 minutos, y dos juntos a los 28. */
const bosses = (enemy: string): StageEvent[] => [
  { at: 10 * MIN, kind: 'boss', enemy, count: 1 },
  { at: 20 * MIN, kind: 'boss', enemy, count: 1 },
  { at: 28 * MIN, kind: 'boss', enemy, count: 2 },
];
const timeline = (events: StageEvent[]) => events.sort((a, b) => a.at - b.at);

/** Bosque Marchito: escenario inicial. Abierto, sin obstáculos, con oleadas que crecen minuto a minuto. */
export const WITHERED_WOODS: StageDef = {
  id: 'withered_woods',
  name: 'Bosque Marchito',
  price: 0,
  ground: 't_grass',
  props: ['d_tuft', 'd_flower', 'd_stone', 'd_stump', 'd_bush'],
  spawns: [
    spawn('slime', 0, 6, 0.7, 1.5),
    spawn('bat', 1, 10, 0.25, 1.2),
    spawn('bones', 3, 14, 0.4, 1.6),
    spawn('shroom', 5, 18, 0.15, 0.6),
    spawn('wisp', 8, 22, 0.5, 1.8),
    spawn('thorn', 10, 30, 0.1, 0.5),
    spawn('blob', 12, 26, 0.3, 0.9),
    spawn('golem', 14, 30, 0.05, 0.35),
    spawn('bones', 14, 30, 1.6, 2.6),
    spawn('wisp', 22, 30, 1.8, 3),
  ],
  events: timeline([
    ring(2.5, 'bat', 16),
    ring(5, 'slime', 40),
    ring(8, 'bones', 30),
    ring(12, 'wisp', 40),
    ring(16, 'blob', 24),
    ring(22, 'bones', 50),
    ring(25, 'wisp', 60),
    ...bosses('elder'),
    ...elites(['bones', 'shroom', 'blob', 'golem']),
  ]),
};

/** Pantano Sombrío: enemigos a distancia que escupen y disparan; hay que moverse sin parar. */
export const GLOOM_BOG: StageDef = {
  id: 'gloom_bog',
  name: 'Pantano Sombrío',
  price: 5000,
  ground: 't_bog',
  props: ['d_reed', 'd_puddle', 'd_log', 'd_tuft'],
  spawns: [
    spawn('leech', 0, 8, 0.6, 1.4),
    spawn('toad', 1, 12, 0.25, 0.9),
    spawn('bat', 2, 12, 0.2, 0.8),
    spawn('wisp', 4, 18, 0.3, 1.2),
    spawn('shroom', 8, 20, 0.1, 0.4),
    spawn('thorn', 6, 26, 0.2, 0.7),
    spawn('blob', 10, 24, 0.2, 0.7),
    spawn('toad', 12, 30, 0.9, 1.5),
    spawn('leech', 12, 30, 1.4, 2.4),
    spawn('golem', 16, 30, 0.05, 0.3),
  ],
  events: timeline([
    ring(2.5, 'bat', 16),
    ring(5, 'leech', 40),
    ring(8, 'toad', 14),
    ring(12, 'wisp', 40),
    ring(16, 'blob', 24),
    ring(22, 'leech', 60),
    ring(25, 'toad', 24),
    ...bosses('bog_king'),
    ...elites(['toad', 'toad', 'blob', 'golem']),
  ]),
};

/** Cripta Olvidada: enjambres enormes de bichos pequeños. Armas de área y de atravesar. */
export const FORGOTTEN_CRYPT: StageDef = {
  id: 'forgotten_crypt',
  name: 'Cripta Olvidada',
  price: 15000,
  ground: 't_crypt',
  props: ['d_tomb', 'd_bones', 'd_pillar', 'd_stone'],
  spawns: [
    spawn('rat', 0, 10, 1.2, 3),
    spawn('bat', 1, 12, 0.3, 1.2),
    spawn('bones', 2, 16, 0.5, 1.8),
    spawn('archer', 5, 20, 0.15, 0.6),
    spawn('wisp', 8, 22, 0.4, 1.4),
    spawn('blob', 12, 26, 0.2, 0.7),
    spawn('rat', 10, 30, 3, 4.5),
    spawn('bones', 14, 30, 1.8, 2.8),
    spawn('golem', 16, 30, 0.05, 0.3),
    spawn('archer', 20, 30, 0.6, 0.9),
  ],
  events: timeline([
    ring(2, 'rat', 60),
    ring(4.5, 'rat', 80),
    ring(7, 'bones', 30),
    ring(13, 'rat', 100),
    ring(15, 'bat', 40),
    ring(18, 'archer', 16),
    ring(24, 'rat', 120),
    ring(26, 'bones', 60),
    ...bosses('bone_lord'),
    ...elites(['bones', 'archer', 'blob', 'golem']),
  ]),
};

/** Cavernas de Cristal: pocos enemigos, pero muy resistentes y que apenas retroceden. Daño por golpe alto. */
export const CRYSTAL_CAVES: StageDef = {
  id: 'crystal_caves',
  name: 'Cavernas de Cristal',
  price: 35000,
  ground: 't_cave',
  props: ['d_crystal', 'd_rock', 'd_stalagmite', 'd_stone'],
  spawns: [
    spawn('bones', 0, 6, 0.5, 0.9),
    spawn('crystal', 1, 30, 0.12, 0.6),
    spawn('shroom', 2, 16, 0.3, 0.8),
    spawn('imp', 4, 18, 0.2, 0.8),
    spawn('golem', 5, 30, 0.08, 0.5),
    spawn('blob', 6, 24, 0.25, 0.8),
    spawn('bat', 8, 20, 0.3, 0.8),
    spawn('crystal', 14, 30, 0.6, 1),
    spawn('imp', 18, 30, 0.8, 1.4),
  ],
  events: timeline([
    ring(3, 'bones', 20),
    ring(6, 'shroom', 16),
    ring(11, 'crystal', 12),
    ring(14, 'golem', 10),
    ring(17, 'imp', 30),
    ring(23, 'crystal', 20),
    ring(26, 'golem', 16),
    ...bosses('crystal_titan'),
    ...elites(['shroom', 'crystal', 'crystal', 'golem']),
  ]),
};

/** Páramo de Ceniza: lo mejor de todo —embestidas, flechas, enjambres y bloques— para quien ya domina el juego. */
export const ASH_WASTES: StageDef = {
  id: 'ash_wastes',
  name: 'Páramo de Ceniza',
  price: 70000,
  ground: 't_ash',
  props: ['d_cinder', 'd_deadtree', 'd_rock', 'd_bones'],
  spawns: [
    spawn('imp', 0, 12, 0.5, 1.6),
    spawn('bat', 0, 8, 0.4, 1),
    spawn('archer', 2, 16, 0.25, 0.9),
    spawn('wisp', 3, 20, 0.5, 1.6),
    spawn('bones', 4, 18, 0.5, 1.4),
    spawn('crystal', 8, 26, 0.15, 0.6),
    spawn('blob', 10, 26, 0.3, 0.9),
    spawn('golem', 12, 30, 0.1, 0.5),
    spawn('imp', 12, 30, 1.6, 2.6),
    spawn('archer', 16, 30, 0.9, 1.4),
    spawn('wisp', 20, 30, 1.6, 2.6),
    spawn('crystal', 24, 30, 0.6, 0.9),
  ],
  events: timeline([
    ring(2, 'bat', 20),
    ring(4.5, 'imp', 30),
    ring(7, 'archer', 12),
    ring(12, 'wisp', 50),
    ring(15, 'imp', 50),
    ring(17, 'blob', 24),
    ring(22, 'bones', 60),
    ring(24, 'archer', 20),
    ring(26, 'wisp', 70),
    ...bosses('cinder_lord'),
    ...elites(['imp', 'archer', 'crystal', 'golem']),
  ]),
};

/** Escenarios en orden de desbloqueo. */
export const STAGES: StageDef[] = [WITHERED_WOODS, GLOOM_BOG, FORGOTTEN_CRYPT, CRYSTAL_CAVES, ASH_WASTES];
export const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s]));
