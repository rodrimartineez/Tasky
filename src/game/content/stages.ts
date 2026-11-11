import type { StageDef, StageEvent } from '../sim/types';

const MIN = 60;

/** Un enemigo de élite (con cofre) cada 90 s; el tipo cambia con el avance de la partida. */
function elites(): StageEvent[] {
  const out: StageEvent[] = [];
  for (let at = 90; at < 30 * MIN; at += 90) {
    const enemy = at < 6 * MIN ? 'bones' : at < 14 * MIN ? 'shroom' : at < 22 * MIN ? 'blob' : 'golem';
    out.push({ at, kind: 'elite', enemy, count: 1 });
  }
  return out;
}

/** Bosque Marchito: escenario inicial. Abierto, sin obstáculos, con oleadas que crecen minuto a minuto. */
export const WITHERED_WOODS: StageDef = {
  id: 'withered_woods',
  name: 'Bosque Marchito',
  price: 0,
  ground: 't_grass',
  props: ['d_tuft', 'd_flower', 'd_stone', 'd_stump', 'd_bush'],
  spawns: [
    { enemy: 'slime', from: 0, to: 6, rateStart: 0.7, rateEnd: 1.5 },
    { enemy: 'bat', from: 1, to: 10, rateStart: 0.25, rateEnd: 1.2 },
    { enemy: 'bones', from: 3, to: 14, rateStart: 0.4, rateEnd: 1.6 },
    { enemy: 'shroom', from: 5, to: 18, rateStart: 0.15, rateEnd: 0.6 },
    { enemy: 'wisp', from: 8, to: 22, rateStart: 0.5, rateEnd: 1.8 },
    { enemy: 'thorn', from: 10, to: 30, rateStart: 0.1, rateEnd: 0.5 },
    { enemy: 'blob', from: 12, to: 26, rateStart: 0.3, rateEnd: 0.9 },
    { enemy: 'golem', from: 14, to: 30, rateStart: 0.05, rateEnd: 0.35 },
    { enemy: 'bones', from: 14, to: 30, rateStart: 1.6, rateEnd: 2.6 },
    { enemy: 'wisp', from: 22, to: 30, rateStart: 1.8, rateEnd: 3 },
  ],
  events: [
    { at: 2.5 * MIN, kind: 'ring', enemy: 'bat', count: 16 },
    { at: 5 * MIN, kind: 'ring', enemy: 'slime', count: 40 },
    { at: 8 * MIN, kind: 'ring', enemy: 'bones', count: 30 },
    { at: 10 * MIN, kind: 'boss', enemy: 'elder', count: 1 },
    { at: 12 * MIN, kind: 'ring', enemy: 'wisp', count: 40 },
    { at: 16 * MIN, kind: 'ring', enemy: 'blob', count: 24 },
    { at: 20 * MIN, kind: 'boss', enemy: 'elder', count: 1 },
    { at: 22 * MIN, kind: 'ring', enemy: 'bones', count: 50 },
    { at: 25 * MIN, kind: 'ring', enemy: 'wisp', count: 60 },
    { at: 28 * MIN, kind: 'boss', enemy: 'elder', count: 2 },
    ...elites(),
  ].sort((a, b) => a.at - b.at) as StageEvent[],
};

/** Escenarios en orden de desbloqueo (el resto llega en la Fase 5). */
export const STAGES: StageDef[] = [WITHERED_WOODS];
export const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s]));
