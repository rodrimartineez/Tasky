import type { EnemyDef } from '../sim/types';

/**
 * Jefes de ciclo (HABITS_GUIDE §11): cierran cada ciclo de 7 niveles (niveles 7, 14, 21…). Son 10 y se van
 * alternando; al acabar la rotación vuelven a salir en orden, más fuertes y con ataques nuevos (sim/bosses.ts):
 * - Siempre: vida y daño según el nivel, como el resto de enemigos.
 * - Desde la 2.ª vuelta: añaden sus ataques `advanced` y se enfurecen por debajo de la mitad de vida.
 * - En cada vuelta: más proyectiles, ataques más seguidos y algo más de vida.
 * Aparecen en el minuto 20; para superar el nivel hay que vencerlo antes de que llegue La Muerte (minuto 30).
 * Cada uno tiene ataques propios que lo identifican: ondas sísmicas, huevos que eclosionan, telarañas y burbujas de
 * tiempo que ralentizan, sombras y cabezas que disparan, charcos de plaga, rayos y barridos, y la gravedad del abismo.
 */
const boss = (def: Omit<EnemyDef, 'ai' | 'knockResist' | 'xp'>): EnemyDef => ({ ...def, ai: 'boss', knockResist: 1, xp: 400 });

export const CYCLE_BOSSES: EnemyDef[] = [
  boss({
    id: 'gatekeeper',
    name: 'Guardián del Umbral',
    sprite: 'e_gatekeeper',
    hp: 6000,
    speed: 20,
    damage: 26,
    radius: 18,
    patterns: ['quake', 'charge', 'radial'],
    advanced: ['wall', 'summon'],
    minion: 'bones',
    color: 0xf2c46b,
  }),
  boss({
    id: 'broodmother',
    name: 'Madre de la Nidada',
    sprite: 'e_broodmother',
    hp: 6500,
    speed: 24,
    damage: 24,
    radius: 18,
    patterns: ['eggs', 'slow', 'fan'],
    advanced: ['summon', 'rain'],
    minion: 'bat',
    color: 0xb06bff,
  }),
  boss({
    id: 'colossus',
    name: 'Coloso de Piedra',
    sprite: 'e_colossus',
    hp: 8000,
    speed: 16,
    damage: 34,
    radius: 19,
    patterns: ['quake', 'charge', 'rain'],
    advanced: ['wall', 'heads'],
    minion: 'golem',
    color: 0xc9b38a,
  }),
  boss({
    id: 'shadow_magus',
    name: 'Mago de las Sombras',
    sprite: 'e_shadow_magus',
    hp: 6500,
    speed: 22,
    damage: 26,
    radius: 17,
    patterns: ['clones', 'blink', 'laser'],
    advanced: ['spiral', 'rain'],
    minion: 'wisp',
    color: 0x8a7bff,
  }),
  boss({
    id: 'hydra',
    name: 'Hidra del Pantano',
    sprite: 'e_hydra',
    hp: 7500,
    speed: 18,
    damage: 28,
    radius: 19,
    patterns: ['heads', 'pools', 'fan'],
    advanced: ['spiral', 'summon'],
    minion: 'leech',
    color: 0x6bd96b,
  }),
  boss({
    id: 'plague_lord',
    name: 'Señor de la Plaga',
    sprite: 'e_plague_lord',
    hp: 7000,
    speed: 20,
    damage: 26,
    radius: 18,
    patterns: ['pools', 'summon', 'radial'],
    advanced: ['rain', 'gravity'],
    minion: 'rat',
    color: 0x9fd94a,
  }),
  boss({
    id: 'wraith_knight',
    name: 'Caballero Espectral',
    sprite: 'e_wraith_knight',
    hp: 7500,
    speed: 26,
    damage: 32,
    radius: 17,
    patterns: ['sweep', 'charge', 'blink'],
    advanced: ['clones', 'fan'],
    minion: 'bones',
    color: 0x7fd8ff,
  }),
  boss({
    id: 'abyss_maw',
    name: 'Fauces del Abismo',
    sprite: 'e_abyss_maw',
    hp: 9000,
    speed: 15,
    damage: 30,
    radius: 20,
    patterns: ['gravity', 'spiral', 'summon'],
    advanced: ['pools', 'wall'],
    minion: 'blob',
    color: 0xff6b8a,
  }),
  boss({
    id: 'chrono_weaver',
    name: 'Tejedora del Tiempo',
    sprite: 'e_chrono_weaver',
    hp: 8000,
    speed: 22,
    damage: 28,
    radius: 17,
    patterns: ['slow', 'laser', 'blink'],
    advanced: ['spiral', 'clones'],
    minion: 'imp',
    color: 0x6bf2e0,
  }),
  boss({
    id: 'eclipse_dragon',
    name: 'Dragón del Eclipse',
    sprite: 'e_eclipse_dragon',
    hp: 10000,
    speed: 20,
    damage: 34,
    radius: 21,
    patterns: ['laser', 'sweep', 'rain', 'charge'],
    advanced: ['eggs', 'quake'],
    minion: 'imp',
    color: 0xff9a3c,
  }),
];

/** La Muerte: aparece en el minuto 30 y acaba la partida. No recibe daño. */
export const REAPER: EnemyDef = {
  id: 'reaper',
  name: 'La Muerte',
  sprite: 'e_reaper',
  hp: 1e12,
  speed: 0,
  damage: 0,
  radius: 9,
  xp: 0,
  ai: 'reaper',
  knockResist: 1,
};

/** Niveles por ciclo: el último de cada ciclo es el del jefe. */
export const CYCLE_LENGTH = 7;
/** Minuto (en segundos) en que aparece el jefe de ciclo. */
export const CYCLE_BOSS_AT = 20 * 60;

export const isBossLevel = (level: number) => level > 0 && level % CYCLE_LENGTH === 0;
/** Jefe de un nivel de jefe (o null) y en qué vuelta de la rotación está. */
export function cycleBossFor(level: number): { id: string; round: number } | null {
  if (!isBossLevel(level)) return null;
  const index = level / CYCLE_LENGTH - 1;
  return { id: CYCLE_BOSSES[index % CYCLE_BOSSES.length].id, round: Math.floor(index / CYCLE_BOSSES.length) };
}

export const CYCLE_BOSS_BY_ID = new Map(CYCLE_BOSSES.map((b) => [b.id, b]));
