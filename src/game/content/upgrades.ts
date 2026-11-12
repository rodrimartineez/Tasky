import type { Stats } from '../sim/types';

/**
 * Mejoras permanentes del personaje (se compran con puntos de hábitos). Sin nivel máximo:
 * el coste de cada nivel crece (`cost`) y cada nivel suma lo mismo que el anterior o algo menos,
 * así ninguna mejora se «completa» y ninguna deja obsoletas a las demás. Ver ANALISIS_ECONOMIA.md.
 */
export interface UpgradeDef {
  id: string;
  name: string;
  /** Sprite del icono. */
  icon: string;
  /** Texto del efecto acumulado con `level` niveles, p. ej. «+25 % de daño». */
  effect(level: number): string;
  /** Puntos que cuesta comprar el nivel `level` (el primero es 1). */
  cost(level: number): number;
  /** Aplica `level` niveles a las estadísticas. */
  apply(stats: Stats, level: number): void;
  /** Nivel máximo (solo las mejoras que lo tienen; las de combate no tienen límite). */
  maxLevel?: number;
}

/** Coste polinómico: base · nivel^exp. Con exp ≈ 1,5 el precio crece sin dispararse. */
const poly = (base: number, exp: number) => (level: number) => Math.ceil(base * Math.pow(level, exp));
/** Coste exponencial para mejoras muy potentes (proyectiles extra): en la práctica, pocas unidades en años. */
const expo = (base: number, factor: number) => (level: number) => Math.ceil(base * Math.pow(factor, level - 1));

const pct = (n: number) => `${Math.round(n * 100)} %`;
const fixed = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-ES');

/**
 * Mejora de recompensas «Constancia» (ANALISIS_ECONOMIA.md §13; se aplica al conceder las recompensas en habits/core/habits.ts): cada nivel suma +1 punto
 * a cada hábito diario cumplido y +3 a cada semanal, hasta el nivel 4 (5 y 15 puntos de base). Las bonificaciones de
 * racha se suman aparte. Costes en BOUNTY.costs (el primero, 21 exactos).
 */
export const BOUNTY = { id: 'bounty', costs: [21, 75, 200, 450], daily: 1, weekly: 3 };
export const BOUNTY_MAX = BOUNTY.costs.length;
export const bountyDaily = (level: number) => Math.min(level, BOUNTY_MAX) * BOUNTY.daily;
export const bountyWeekly = (level: number) => Math.min(level, BOUNTY_MAX) * BOUNTY.weekly;

export const UPGRADES: UpgradeDef[] = [
  {
    // No toca el combate: sube los puntos que dan los hábitos (habits/core/rewards.ts, BOUNTY).
    id: BOUNTY.id,
    name: 'Constancia',
    icon: 'u_bounty',
    effect: (n) => `Cada hábito diario da ${1 + bountyDaily(n)} puntos y cada semanal ${3 + bountyWeekly(n)} (más las rachas)`,
    cost: (n) => BOUNTY.costs[n - 1] ?? Infinity,
    apply: () => {},
    maxLevel: BOUNTY_MAX,
  },
  {
    id: 'might',
    name: 'Poder',
    icon: 'p_whetstone',
    effect: (n) => `+${pct(0.05 * n)} de daño`,
    cost: poly(4, 1.5),
    apply: (s, n) => void (s.might *= 1 + 0.05 * n),
  },
  {
    id: 'maxHp',
    name: 'Vitalidad',
    icon: 'p_heart',
    effect: (n) => `+${pct(0.05 * n)} de vida máxima`,
    cost: poly(4, 1.5),
    apply: (s, n) => void (s.maxHp *= 1 + 0.05 * n),
  },
  {
    id: 'armor',
    name: 'Armadura',
    icon: 'u_armor',
    effect: (n) => `−${fixed(0.5 * n)} de daño recibido por golpe`,
    cost: poly(5, 1.55),
    apply: (s, n) => void (s.armor += 0.5 * n),
  },
  {
    id: 'regen',
    name: 'Recuperación',
    icon: 'u_regen',
    effect: (n) => `+${fixed(0.1 * n)} de vida por segundo`,
    cost: poly(5, 1.5),
    apply: (s, n) => void (s.regen += 0.1 * n),
  },
  {
    id: 'cooldown',
    name: 'Celeridad',
    icon: 'p_hourglass',
    effect: (n) => `+${pct(0.03 * n)} de velocidad de ataque`,
    cost: poly(5, 1.55),
    // Ataques más frecuentes: el tiempo entre ataques se divide (nunca llega a cero).
    apply: (s, n) => void (s.cooldown /= 1 + 0.03 * n),
  },
  {
    id: 'area',
    name: 'Alcance',
    icon: 'p_lens',
    effect: (n) => `+${pct(0.03 * n)} de área`,
    cost: poly(5, 1.55),
    apply: (s, n) => void (s.area *= 1 + 0.03 * n),
  },
  {
    id: 'moveSpeed',
    name: 'Agilidad',
    icon: 'p_boots',
    // Rendimientos decrecientes: correr demasiado rompería el juego (huir de todo).
    effect: (n) => `+${pct(0.5 * (1 - Math.pow(0.97, n)))} de velocidad`,
    cost: poly(5, 1.5),
    apply: (s, n) => void (s.moveSpeed *= 1 + 0.5 * (1 - Math.pow(0.97, n))),
  },
  {
    id: 'duration',
    name: 'Persistencia',
    icon: 'u_duration',
    effect: (n) => `+${pct(0.04 * n)} de duración de efectos`,
    cost: poly(5, 1.5),
    apply: (s, n) => void (s.duration *= 1 + 0.04 * n),
  },
  {
    id: 'projSpeed',
    name: 'Ímpetu',
    icon: 'u_speed',
    effect: (n) => `+${pct(0.04 * n)} de velocidad de proyectiles`,
    cost: poly(4, 1.5),
    apply: (s, n) => void (s.projSpeed *= 1 + 0.04 * n),
  },
  {
    id: 'crit',
    name: 'Precisión',
    icon: 'u_crit',
    // Se acerca al 100 % sin llegar nunca.
    effect: (n) => `+${pct(1 - Math.pow(0.985, n))} de probabilidad de crítico`,
    cost: poly(5, 1.5),
    apply: (s, n) => void (s.critChance = 1 - (1 - s.critChance) * Math.pow(0.985, n)),
  },
  {
    id: 'critMult',
    name: 'Brutalidad',
    icon: 'u_critmult',
    effect: (n) => `+${pct(0.08 * n)} de daño crítico`,
    cost: poly(4, 1.5),
    apply: (s, n) => void (s.critMult += 0.08 * n),
  },
  {
    id: 'pickup',
    name: 'Magnetismo',
    icon: 'p_lodestone',
    effect: (n) => `+${pct(0.08 * n)} de alcance de recogida`,
    cost: poly(3, 1.45),
    apply: (s, n) => void (s.pickup *= 1 + 0.08 * n),
  },
  {
    id: 'growth',
    name: 'Sabiduría',
    icon: 'i_xp2',
    effect: (n) => `+${pct(0.03 * n)} de experiencia`,
    cost: poly(4, 1.55),
    apply: (s, n) => void (s.growth *= 1 + 0.03 * n),
  },
  {
    id: 'luck',
    name: 'Fortuna',
    icon: 'u_luck',
    effect: (n) => `+${pct(0.04 * n)} de suerte`,
    cost: poly(4, 1.5),
    apply: (s, n) => void (s.luck *= 1 + 0.04 * n),
  },
  {
    id: 'greed',
    name: 'Codicia',
    icon: 'i_coin',
    effect: (n) => `+${pct(0.04 * n)} de oro`,
    cost: poly(4, 1.5),
    apply: (s, n) => void (s.greed *= 1 + 0.04 * n),
  },
  {
    id: 'amount',
    name: 'Multiplicidad',
    icon: 'u_amount',
    effect: (n) => `+${n} ${n === 1 ? 'proyectil' : 'proyectiles'} en cada arma`,
    cost: expo(120, 4),
    apply: (s, n) => void (s.amount += n),
  },
  {
    id: 'revival',
    name: 'Segunda vida',
    icon: 'u_revive',
    // Muy potente: el coste se multiplica por 5 en cada nivel, así que en la práctica son 2–3 en años.
    effect: (n) => `Revive ${n === 1 ? 'una vez' : `${n} veces`} por partida con media vida`,
    cost: expo(500, 5),
    apply: (s, n) => void (s.revival += n),
  },
  {
    id: 'rerolls',
    name: 'Repetir elección',
    icon: 'u_reroll',
    effect: (n) => `${n} ${n === 1 ? 'repetición' : 'repeticiones'} de las opciones al subir de nivel por partida`,
    cost: expo(150, 3),
    apply: (s, n) => void (s.rerolls += n),
  },
  {
    id: 'banishes',
    name: 'Descartar',
    icon: 'u_banish',
    effect: (n) => `${n} ${n === 1 ? 'descarte' : 'descartes'} por partida: la opción elegida no vuelve a salir`,
    cost: expo(200, 3),
    apply: (s, n) => void (s.banishes += n),
  },
];

export const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

/** Estadísticas tras aplicar las mejoras compradas (nivel por id) sobre unas estadísticas base. */
export function withUpgrades(base: Stats, levels: Record<string, number>): Stats {
  const stats = { ...base };
  for (const u of UPGRADES) {
    const level = levels[u.id] ?? 0;
    if (level > 0) u.apply(stats, level);
  }
  return stats;
}
