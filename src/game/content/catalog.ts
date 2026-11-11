import { BASE_STATS, type PassiveDef, type Stats, type WeaponDef, type WeaponStats } from '../sim/types';
import { EVOLUTIONS, type EvolutionDef } from './evolutions';
import { PASSIVE_BY_ID, PASSIVES } from './passives';
import { WEAPON_BY_ID, WEAPONS, weaponStatsAt } from './weapons';

/**
 * Catálogo del juego (apartado «Catálogo» de Hábitos). Todo se deriva de las definiciones centrales: un arma, pasiva
 * o evolución nueva aparece sola, con sus datos reales. Lo único escrito a mano son los nombres de las estadísticas,
 * y `Record<keyof Stats, …>` obliga a añadir el de cada estadística nueva.
 */

type StatFormat = 'relative' | 'absolute' | 'fraction' | 'multiplier';
const STAT_INFO: Record<keyof Stats, { label: string; format: StatFormat; unit?: string }> = {
  maxHp: { label: 'Vida máxima', format: 'absolute' },
  regen: { label: 'Regeneración', format: 'absolute', unit: ' de vida/s' },
  armor: { label: 'Armadura', format: 'absolute' },
  moveSpeed: { label: 'Velocidad de movimiento', format: 'relative' },
  might: { label: 'Daño', format: 'relative' },
  area: { label: 'Área de las armas', format: 'relative' },
  cooldown: { label: 'Tiempo entre ataques', format: 'relative' },
  projSpeed: { label: 'Velocidad de proyectiles', format: 'relative' },
  duration: { label: 'Duración de los efectos', format: 'relative' },
  amount: { label: 'Proyectiles en cada arma', format: 'absolute' },
  pickup: { label: 'Alcance de recogida', format: 'relative' },
  luck: { label: 'Suerte', format: 'relative' },
  growth: { label: 'Experiencia', format: 'relative' },
  greed: { label: 'Oro', format: 'relative' },
  critChance: { label: 'Probabilidad de crítico', format: 'fraction' },
  critMult: { label: 'Daño crítico', format: 'multiplier' },
  revival: { label: 'Revivir', format: 'absolute' },
  rerolls: { label: 'Repetir elección', format: 'absolute' },
  banishes: { label: 'Descartar', format: 'absolute' },
  leech: { label: 'Robo de vida', format: 'fraction' },
};

const num = (n: number, digits = 2) => n.toLocaleString('es-ES', { maximumFractionDigits: digits });
const signed = (n: number, text: string) => `${n > 0 ? '+' : '−'}${text}`;

/** Cambio de una estadística, en texto («+10 %», «+20», «−6 %»…). */
function formatChange(key: keyof Stats, from: number, to: number): string {
  const { format, unit = '' } = STAT_INFO[key];
  const d = to - from;
  switch (format) {
    case 'relative':
      return signed(d, `${num(Math.abs((d / from) * 100), 1)} %`);
    case 'fraction':
      return signed(d, `${num(Math.abs(d * 100), 1)} %`);
    case 'multiplier':
      return signed(d, `${num(Math.abs(d))}×`);
    default:
      return signed(d, `${num(Math.abs(d))}${unit}`);
  }
}

export interface StatChange {
  stat: keyof Stats;
  label: string;
  /** Con un nivel de la pasiva. */
  perLevel: string;
  /** Con la pasiva al nivel máximo. */
  atMax: string;
}

/** Estadísticas que modifica una pasiva, calculadas aplicándola de verdad sobre las estadísticas base. */
export function passiveChanges(p: PassiveDef): StatChange[] {
  const at = (level: number) => {
    const s = { ...BASE_STATS };
    p.apply(s, level);
    return s;
  };
  const one = at(1);
  const max = at(p.maxLevel);
  return (Object.keys(STAT_INFO) as (keyof Stats)[])
    .filter((k) => max[k] !== BASE_STATS[k])
    .map((k) => ({
      stat: k,
      label: STAT_INFO[k].label,
      perLevel: formatChange(k, BASE_STATS[k], one[k]),
      atMax: formatChange(k, BASE_STATS[k], max[k]),
    }));
}

/** Valores principales de un arma, para mostrarlos en una tabla. */
export interface WeaponFigures {
  damage: string;
  cooldown: string;
  amount: string;
  pierce: string;
  area: string;
}
export const WEAPON_FIGURE_LABELS: Record<keyof WeaponFigures, string> = {
  damage: 'Daño por golpe',
  cooldown: 'Recarga',
  amount: 'Cantidad',
  pierce: 'Atraviesa / rebota',
  area: 'Alcance o tamaño',
};
export function figuresOf(s: WeaponStats): WeaponFigures {
  return {
    damage: num(s.damage),
    cooldown: `${num(s.cooldown)} s`,
    amount: num(s.amount),
    pierce: s.pierce >= 999 ? 'Todos' : num(s.pierce),
    area: num(s.area),
  };
}

export interface WeaponEntry {
  def: WeaponDef;
  attack: string;
  maxLevel: number;
  first: WeaponFigures;
  last: WeaponFigures;
  /** Lo que da cada nivel, del 2 al máximo. */
  levels: { level: number; text: string }[];
  /** Evoluciones a las que da paso. */
  evolutions: EvolutionDef[];
}

/** Tipo de ataque: el del arma o, en una evolución, el de su base. */
export const attackOf = (def: WeaponDef): string =>
  def.attack ?? (def.evolvedFrom ? WEAPON_BY_ID.get(def.evolvedFrom)?.attack : undefined) ?? 'Especial';

export function weaponEntries(): WeaponEntry[] {
  return WEAPONS.map((def) => {
    const maxLevel = def.levels.length + 1;
    return {
      def,
      attack: attackOf(def),
      maxLevel,
      first: figuresOf(weaponStatsAt(def, 1)),
      last: figuresOf(weaponStatsAt(def, maxLevel)),
      levels: def.levels.map((l, i) => ({ level: i + 2, text: l.text })),
      evolutions: EVOLUTIONS.filter((e) => e.weapon === def.id),
    };
  });
}

export interface PassiveEntry {
  def: PassiveDef;
  changes: StatChange[];
  /** Evoluciones que necesitan esta pasiva. */
  evolutions: EvolutionDef[];
}

export const passiveEntries = (): PassiveEntry[] =>
  PASSIVES.map((def) => ({ def, changes: passiveChanges(def), evolutions: EVOLUTIONS.filter((e) => e.passive === def.id) }));

export interface EvolutionEntry {
  evolution: EvolutionDef;
  weapon: WeaponDef;
  passive: PassiveDef;
  attack: string;
  /** Arma base a su nivel máximo frente a la evolución. */
  before: WeaponFigures;
  after: WeaponFigures;
}

export function evolutionEntries(): EvolutionEntry[] {
  return EVOLUTIONS.map((evolution) => {
    const weapon = WEAPON_BY_ID.get(evolution.weapon)!;
    return {
      evolution,
      weapon,
      passive: PASSIVE_BY_ID.get(evolution.passive)!,
      attack: attackOf(evolution.def),
      before: figuresOf(weaponStatsAt(weapon, weapon.levels.length + 1)),
      after: figuresOf(weaponStatsAt(evolution.def, 1)),
    };
  });
}
