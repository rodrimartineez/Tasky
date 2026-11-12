import type { Stats } from '../sim/types';

/**
 * Arcanos (Fase 10, propuesta B3): modificadores que se eligen al empezar una partida. Se desbloquean con oro y
 * solo afectan a esa partida. Todos cambian el riesgo y pagan más oro; ninguno da poder permanente ni ayuda a subir
 * de nivel (siempre hacen la partida igual de difícil o más). Se puede llevar uno por partida.
 */
export interface ArcanaDef {
  id: string;
  name: string;
  icon: string;
  /** Qué cambia, en una frase. */
  text: string;
  price: number;
  /** Multiplicador de la dureza de los enemigos (vida, y con ella daño y densidad: sim/difficulty.ts). */
  hardness?: number;
  /** Multiplicador del oro de la partida. */
  gold: number;
  /** Cambios en el personaje durante la partida. */
  apply?: (stats: Stats) => void;
}

export const ARCANA: ArcanaDef[] = [
  {
    id: 'blood',
    name: 'Luna de sangre',
    icon: 'a_blood',
    text: 'Enemigos un 50 % más duros. Oro ×1,6.',
    price: 20_000,
    hardness: 1.5,
    gold: 1.6,
  },
  {
    id: 'glass',
    name: 'Cristal',
    icon: 'a_glass',
    text: 'La mitad de vida máxima y sin regeneración, pero +30 % de daño. Oro ×1,5.',
    price: 45_000,
    gold: 1.5,
    apply: (s) => {
      s.maxHp *= 0.5;
      s.regen = 0;
      s.might *= 1.3;
    },
  },
  {
    id: 'echo',
    name: 'Eco',
    icon: 'a_echo',
    text: 'Cada arma dispara un proyectil más, pero los enemigos son el doble de duros. Oro ×1,4.',
    price: 90_000,
    hardness: 2,
    gold: 1.4,
    apply: (s) => {
      s.amount += 1;
    },
  },
  {
    id: 'void',
    name: 'Vacío',
    icon: 'a_void',
    text: 'Imán casi nulo: hay que ir a por cada gema. Experiencia +20 %. Oro ×1,4.',
    price: 160_000,
    gold: 1.4,
    apply: (s) => {
      s.pickup = 8;
      s.growth *= 1.2;
    },
  },
  {
    id: 'tempest',
    name: 'Tempestad',
    icon: 'a_tempest',
    text: 'Te mueves un 25 % más rápido y los enemigos son un 80 % más duros. Oro ×1,7.',
    price: 300_000,
    hardness: 1.8,
    gold: 1.7,
    apply: (s) => {
      s.moveSpeed *= 1.25;
    },
  },
];

export const ARCANA_BY_ID = new Map(ARCANA.map((a) => [a.id, a]));
