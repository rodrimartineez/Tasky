import type { PassiveDef, Stats } from '../sim/types';

/**
 * Objetos pasivos: mejoran las estadísticas durante la partida (se pierden al terminarla). Solo están los que piden
 * las recetas de evolución del catálogo (content/evolutions.ts), con los valores y niveles de la referencia del género.
 */

// `?? 1`: las partidas guardadas antes de la maldición no tienen el campo.
const curse = (s: Stats, amount: number) => void (s.curse = (s.curse ?? 1) + amount);

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
    text: 'Ataques un 8 % más rápidos',
    maxLevel: 5,
    apply: (s, n) => void (s.cooldown *= 1 - 0.08 * n),
  },
  {
    id: 'lens',
    name: 'Lente ancha',
    icon: 'p_lens',
    text: '+10 % de área de las armas',
    maxLevel: 5,
    apply: (s, n) => void (s.area += 0.1 * n),
  },
  {
    id: 'oakheart',
    name: 'Corazón de roble',
    icon: 'p_heart',
    text: '+20 % de vida máxima',
    maxLevel: 5,
    apply: (s, n) => void (s.maxHp *= 1 + 0.2 * n),
  },
  {
    id: 'herb',
    name: 'Hierba vital',
    icon: 'p_herb',
    text: '+0,2 de vida por segundo',
    maxLevel: 5,
    apply: (s, n) => void (s.regen += 0.2 * n),
  },
  {
    id: 'lodestone',
    name: 'Piedra imán',
    icon: 'p_lodestone',
    text: 'Más alcance de recogida (+50 % el primer nivel, +25 % los siguientes)',
    maxLevel: 5,
    apply: (s, n) => void (s.pickup *= 1 + (n > 0 ? 0.5 + 0.25 * (n - 1) : 0)),
  },
  {
    id: 'tome',
    name: 'Tomo de sabiduría',
    icon: 'p_tome',
    text: '+8 % de experiencia',
    maxLevel: 5,
    apply: (s, n) => void (s.growth += 0.08 * n),
  },
  {
    id: 'scales',
    name: 'Coraza de escamas',
    icon: 'p_scales',
    text: '+1 de armadura y +10 % de daño devuelto',
    maxLevel: 5,
    // El daño devuelto (Sudario Carmesí) lo calcula sim/core.ts con el nivel de esta pasiva.
    apply: (s, n) => void (s.armor += n),
  },
  {
    id: 'feather',
    name: 'Pluma de halcón',
    icon: 'p_feather',
    text: '+10 % de velocidad de proyectiles',
    maxLevel: 5,
    apply: (s, n) => void (s.projSpeed += 0.1 * n),
  },
  {
    id: 'candle',
    name: 'Vela eterna',
    icon: 'p_candle',
    text: '+10 % de duración de los efectos',
    maxLevel: 5,
    apply: (s, n) => void (s.duration += 0.1 * n),
  },
  {
    id: 'horn',
    name: 'Cuerno gemelo',
    icon: 'p_horn',
    text: '+1 proyectil en cada arma',
    maxLevel: 2,
    apply: (s, n) => void (s.amount += n),
  },
  {
    id: 'clover',
    name: 'Trébol de cuatro hojas',
    icon: 'p_clover',
    text: '+10 % de suerte',
    maxLevel: 5,
    apply: (s, n) => void (s.luck += 0.1 * n),
  },
  {
    id: 'skull',
    name: 'Calavera maldita',
    icon: 'p_skull',
    text: '+10 % de maldición: más enemigos, más rápidos y más resistentes',
    maxLevel: 5,
    apply: (s, n) => curse(s, 0.1 * n),
  },
  {
    id: 'tiramisu',
    name: 'Tiramisú',
    icon: 'p_tiramisu',
    text: '+1 resurrección (revives con media vida)',
    maxLevel: 2,
    apply: (s, n) => void (s.revival += n),
  },
  {
    id: 'silverring',
    name: 'Sortija lunar',
    icon: 'p_silverring',
    text: '+5 % de área y de duración (desde el nivel 2)',
    maxLevel: 9,
    apply: (s, n) => {
      s.area += 0.05 * Math.max(0, n - 1);
      s.duration += 0.05 * Math.max(0, n - 1);
    },
  },
  {
    id: 'goldring',
    name: 'Sortija solar',
    icon: 'p_goldring',
    text: '+5 % de maldición (desde el nivel 2)',
    maxLevel: 9,
    apply: (s, n) => curse(s, 0.05 * Math.max(0, n - 1)),
  },
  {
    id: 'medalleft',
    name: 'Medalla del ocaso',
    icon: 'p_medalleft',
    text: '+5 % de vida máxima y +0,1 de vida por segundo (desde el nivel 2)',
    maxLevel: 9,
    apply: (s, n) => {
      const k = Math.max(0, n - 1);
      s.maxHp *= 1.05 ** k;
      s.regen += 0.1 * k;
    },
  },
  {
    id: 'medalright',
    name: 'Medalla del alba',
    icon: 'p_medalright',
    text: '+5 % de maldición (desde el nivel 2)',
    maxLevel: 9,
    apply: (s, n) => curse(s, 0.05 * Math.max(0, n - 1)),
  },
  {
    id: 'puzzlebox',
    name: 'Caja de engranajes',
    icon: 'p_puzzlebox',
    text: 'Daño, área, duración y velocidad de proyectiles: +4 % el primer nivel y +3 % los siguientes; en el 9, +100 % de maldición',
    maxLevel: 9,
    apply: (s, n) => {
      const bonus = n > 0 ? 0.04 + 0.03 * (Math.min(n, 8) - 1) : 0;
      s.might += bonus;
      s.area += bonus;
      s.duration += bonus;
      s.projSpeed += bonus;
      if (n >= 9) curse(s, 1);
    },
  },
];

export const PASSIVE_BY_ID = new Map(PASSIVES.map((p) => [p.id, p]));
