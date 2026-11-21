import type { Stats } from '../sim/types';

/**
 * Arcanas y darkanas (adaptadas de Vampire Survivors): cartas que se eligen al empezar una partida, hasta dos por
 * partida y mezclando ambas clases. No se compran: cada una se desbloquea sola al cumplir su logro de hábitos
 * (habits/core/records.ts), así que solo se consiguen cumpliendo hábitos. Sus efectos van en `apply` (estadísticas) o
 * en la simulación (sim/arcana.ts), que consulta `RunConfig.arcana`.
 */
export interface ArcanaDef {
  id: string;
  name: string;
  /** Arcana (marco dorado) o darkana (marco violeta). */
  dark: boolean;
  icon: string;
  /** Qué hace, en una frase. */
  text: string;
  /** Logro de hábitos que la desbloquea. */
  achievement: string;
  /** Cambios en las estadísticas del personaje durante la partida. */
  apply?: (stats: Stats) => void;
}

/** Cuántas cartas se pueden llevar a la vez. */
export const MAX_ARCANA = 2;

export const ARCANA: ArcanaDef[] = [
  {
    id: 'chaos',
    name: 'Caos en la noche oscura',
    dark: false,
    icon: 'a_chaos',
    text: 'La velocidad de los proyectiles oscila entre −50 % y +50 % cada 10 s y gana un 1 % por nivel.',
    achievement: 'streak_7',
  },
  {
    id: 'tragic',
    name: 'Princesa trágica',
    dark: false,
    icon: 'a_tragic',
    text: 'Las armas se recargan un 50 % más rápido mientras te mueves.',
    achievement: 'met_50',
  },
  {
    id: 'waltz',
    name: 'Vals de perlas',
    dark: false,
    icon: 'a_waltz',
    text: 'Los proyectiles rectos rebotan hasta 3 veces hacia otro enemigo cercano.',
    achievement: 'streak_30',
  },
  {
    id: 'sarabande',
    name: 'Sarabanda de la curación',
    dark: false,
    icon: 'a_sarabande',
    text: 'La curación se duplica y, al curarte, dañas a los enemigos cercanos por esa cantidad.',
    achievement: 'points_100000',
  },
  {
    id: 'beginning',
    name: 'Principio',
    dark: false,
    icon: 'a_beginning',
    text: '+1 proyectil en las armas; el arma inicial y su evolución ganan +3 en lugar de +1.',
    achievement: 'met_250',
    apply: (s) => {
      s.amount += 1;
    },
  },
  {
    id: 'ironblue',
    name: 'Voluntad azul de hierro',
    dark: false,
    icon: 'a_ironblue',
    text: 'Los proyectiles rectos rebotan hasta 3 veces hacia otro enemigo cercano y atraviesan 2 enemigos más.',
    achievement: 'streak_100',
  },
  {
    id: 'sapphire',
    name: 'Niebla de zafiro',
    dark: true,
    icon: 'a_sapphire',
    text: 'Cada vez que un arma ataca, tiene un 25 % de probabilidad de volver a atacar casi al instante.',
    achievement: 'points_1000000',
  },
  {
    id: 'heir',
    name: 'Heredero del destino',
    dark: true,
    icon: 'a_heir',
    text: 'Cada 25 enemigos abatidos con fuego dan +1 de vida máxima y +0,4 % de daño (hasta 60 veces).',
    achievement: 'met_1000',
  },
];

export const ARCANA_BY_ID = new Map(ARCANA.map((a) => [a.id, a]));
