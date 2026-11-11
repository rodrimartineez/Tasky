import type { PassiveDef } from '../sim/types';

/** Objetos pasivos: mejoran las estadísticas durante la partida (se pierden al terminarla). */
export const PASSIVES: PassiveDef[] = [
  {
    id: 'whetstone',
    name: 'Piedra de afilar',
    icon: 'p_whetstone',
    text: '+10 % de daño',
    maxLevel: 5,
    apply: (s, n) => void (s.might += 0.1 * n),
  },
  {
    id: 'hourglass',
    name: 'Reloj de arena',
    icon: 'p_hourglass',
    text: 'Ataques un 6 % más rápidos',
    maxLevel: 5,
    apply: (s, n) => void (s.cooldown *= 1 - 0.06 * n),
  },
  {
    id: 'lens',
    name: 'Lente ancha',
    icon: 'p_lens',
    text: '+10 % de área',
    maxLevel: 5,
    apply: (s, n) => void (s.area += 0.1 * n),
  },
  {
    id: 'boots',
    name: 'Botas ligeras',
    icon: 'p_boots',
    text: '+8 % de velocidad',
    maxLevel: 5,
    apply: (s, n) => void (s.moveSpeed *= 1 + 0.08 * n),
  },
  {
    id: 'oakheart',
    name: 'Corazón de roble',
    icon: 'p_heart',
    text: '+20 de vida máxima y regeneración',
    maxLevel: 5,
    apply: (s, n) => {
      s.maxHp += 20 * n;
      s.regen += 0.2 * n;
    },
  },
  {
    id: 'lodestone',
    name: 'Piedra imán',
    icon: 'p_lodestone',
    text: '+30 % de alcance de recogida',
    maxLevel: 5,
    apply: (s, n) => void (s.pickup *= 1 + 0.3 * n),
  },
];

export const PASSIVE_BY_ID = new Map(PASSIVES.map((p) => [p.id, p]));
