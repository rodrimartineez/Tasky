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
    text: '+20 de vida máxima',
    maxLevel: 7,
    apply: (s, n) => void (s.maxHp += 20 * n + (n >= 7 ? 30 : 0)),
  },
  {
    id: 'herb',
    name: 'Hierba vital',
    icon: 'p_herb',
    text: '+0,2 de vida por segundo',
    maxLevel: 7,
    apply: (s, n) => void (s.regen += 0.2 * n + (n >= 7 ? 0.2 : 0)),
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
    id: 'tiramisu',
    name: 'Tiramisú',
    icon: 'p_tiramisu',
    text: '+1 resurrección',
    maxLevel: 2,
    apply: (s, n) => void (s.revival += n),
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
  {
    id: 'clover',
    name: 'Trébol de cuatro hojas',
    icon: 'p_clover',
    text: '+10 % de suerte',
    maxLevel: 7,
    apply: (s, n) => void (s.luck += 0.1 * n + (n >= 7 ? 0.1 : 0)),
  },
  {
    id: 'mask',
    name: 'Máscara avara',
    icon: 'p_mask',
    text: '+10 % de oro',
    maxLevel: 7,
    apply: (s, n) => void (s.greed += 0.1 * n + (n >= 7 ? 0.1 : 0)),
  },
  {
    id: 'skull',
    name: 'Calavera maldita',
    icon: 'p_skull',
    text: '+10 % de maldición: más enemigos, más rápidos y más resistentes',
    maxLevel: 5,
    // `?? 1`: las partidas guardadas antes de la maldición no tienen el campo.
    apply: (s, n) => void (s.curse = (s.curse ?? 1) + 0.1 * n),
  },
  {
    id: 'silverring',
    name: 'Sortija lunar',
    icon: 'p_silverring',
    text: '+5 % de área y de duración',
    maxLevel: 7,
    apply: (s, n) => {
      s.area += 0.05 * n;
      s.duration += 0.05 * n;
    },
  },
  {
    id: 'goldring',
    name: 'Sortija solar',
    icon: 'p_goldring',
    text: '+5 % de experiencia y de oro',
    maxLevel: 7,
    apply: (s, n) => {
      s.growth += 0.05 * n;
      s.greed += 0.05 * n;
    },
  },
  {
    id: 'medalleft',
    name: 'Medalla del ocaso',
    icon: 'p_medalleft',
    text: '+10 de vida máxima y +0,05 de vida por segundo',
    maxLevel: 7,
    apply: (s, n) => {
      s.maxHp += 10 * n;
      s.regen += 0.05 * n;
    },
  },
  {
    id: 'medalright',
    name: 'Medalla del alba',
    icon: 'p_medalright',
    text: '+4 % de daño y +4 % de maldición',
    maxLevel: 7,
    apply: (s, n) => {
      s.might += 0.04 * n;
      s.curse = (s.curse ?? 1) + 0.04 * n;
    },
  },
  {
    id: 'puzzlebox',
    name: 'Caja de engranajes',
    icon: 'p_puzzlebox',
    text: '+3 % de daño, área, duración y velocidad de proyectiles; al máximo, +10 % de maldición',
    maxLevel: 7,
    apply: (s, n) => {
      s.might += 0.03 * n;
      s.area += 0.03 * n;
      s.duration += 0.03 * n;
      s.projSpeed += 0.03 * n;
      if (n >= 7) s.curse = (s.curse ?? 1) + 0.1;
    },
  },
];

export const PASSIVE_BY_ID = new Map(PASSIVES.map((p) => [p.id, p]));
