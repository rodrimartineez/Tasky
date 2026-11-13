import type { PassiveDef } from '../sim/types';

/** Objetos pasivos: mejoran las estadísticas durante la partida (se pierden al terminarla). */
export const PASSIVES: PassiveDef[] = [
  {
    id: 'whetstone',
    name: 'Piedra de afilar',
    icon: 'p_whetstone',
    text: '+10 % de daño',
    maxLevel: 7,
    apply: (s, n) => void (s.might += 0.1 * n + (n >= 7 ? 0.15 : 0)),
  },
  {
    id: 'hourglass',
    name: 'Reloj de arena',
    icon: 'p_hourglass',
    text: 'Ataques un 6 % más rápidos',
    maxLevel: 7,
    apply: (s, n) => void (s.cooldown *= 1 - 0.06 * n - (n >= 7 ? 0.06 : 0)),
  },
  {
    id: 'lens',
    name: 'Lente ancha',
    icon: 'p_lens',
    text: '+10 % de área efecto',
    maxLevel: 7,
    apply: (s, n) => void (s.area += 0.1 * n + (n >= 7 ? 0.15 : 0)),
  },
  {
    id: 'boots',
    name: 'Botas ligeras',
    icon: 'p_boots',
    text: '+8 % de velocidad',
    maxLevel: 7,
    apply: (s, n) => void (s.moveSpeed *= 1 + 0.08 * n + (n >= 7 ? 0.05 : 0)),
  },
  {
    id: 'oakheart',
    name: 'Corazón de roble',
    icon: 'p_heart',
    text: '+20 de vida máxima y algo de regeneración',
    maxLevel: 7,
    apply: (s, n) => {
      s.maxHp += 20 * n + (n >= 7 ? 30 : 0);
      s.regen += 0.1 * n + (n >= 7 ? 0.1 : 0);
    },
  },
  {
    id: 'lodestone',
    name: 'Piedra imán',
    icon: 'p_lodestone',
    text: '+30 % de alcance de recogida',
    maxLevel: 7,
    apply: (s, n) => void (s.pickup *= 1 + 0.3 * n + (n >= 7 ? 0.4 : 0)),
  },
  {
    id: 'clover',
    name: 'Trébol de cuatro hojas',
    icon: 'p_clover',
    text: '+15 % de suerte',
    maxLevel: 7,
    apply: (s, n) => void (s.luck += 0.15 * n + (n >= 7 ? 0.15 : 0)),
  },
  {
    id: 'tome',
    name: 'Tomo de sabiduría',
    icon: 'p_tome',
    text: '+8 % de experiencia',
    maxLevel: 7,
    apply: (s, n) => void (s.growth += 0.08 * n + (n >= 7 ? 0.1 : 0)),
  },
  {
    id: 'scales',
    name: 'Coraza de escamas',
    icon: 'p_scales',
    text: '+1 de armadura',
    maxLevel: 7,
    apply: (s, n) => void (s.armor += n),
  },
  {
    id: 'feather',
    name: 'Pluma de halcón',
    icon: 'p_feather',
    text: '+10 % de velocidad de proyectiles',
    maxLevel: 7,
    apply: (s, n) => void (s.projSpeed += 0.1 * n + (n >= 7 ? 0.15 : 0)),
  },
  {
    id: 'candle',
    name: 'Vela eterna',
    icon: 'p_candle',
    text: '+10 % de duración de los efectos',
    maxLevel: 7,
    apply: (s, n) => void (s.duration += 0.1 * n + (n >= 7 ? 0.15 : 0)),
  },
  {
    id: 'horn',
    name: 'Cuerno gemelo',
    icon: 'p_horn',
    text: '+1 proyectil en cada nivel',
    maxLevel: 2,
    apply: (s, n) => void (s.amount += n),
  },
  {
    id: 'eye',
    name: 'Ojo de águila',
    icon: 'p_eye',
    text: '+4 % de crítico y +10 % de daño crítico',
    maxLevel: 7,
    apply: (s, n) => {
      s.critChance = Math.min(1, s.critChance + 0.04 * n + (n >= 7 ? 0.05 : 0));
      s.critMult += 0.1 * n + (n >= 7 ? 0.2 : 0);
    },
  },
  {
    id: 'fang',
    name: 'Colmillo de sangre',
    icon: 'p_fang',
    text: 'Recuperas el 0,15 % del daño que causas (con un tope por segundo)',
    maxLevel: 7,
    // `?? 0`: las partidas guardadas antes de esta pasiva no tienen el campo.
    apply: (s, n) => void (s.leech = (s.leech ?? 0) + 0.0015 * n + (n >= 7 ? 0.0015 : 0)),
  },
];

export const PASSIVE_BY_ID = new Map(PASSIVES.map((p) => [p.id, p]));
