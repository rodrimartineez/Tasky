import type { Stats } from '../sim/types';

/**
 * Personajes jugables, en orden de desbloqueo. Cada uno cambia de verdad la forma de jugar: arma inicial propia
 * y un rasgo que modifica sus estadísticas (siempre una virtud pagada con un defecto). Los precios están en
 * oro (ANALISIS_ECONOMIA.md §7); el primero es gratis.
 */
export interface CharacterDef {
  id: string;
  name: string;
  /** Sprite base (fotogramas `<sprite>_0` y `<sprite>_1`). */
  sprite: string;
  price: number;
  weapon: string;
  /** Armas adicionales con las que empieza (solo los legendarios). */
  bonusWeapons?: string[];
  /** Personaje legendario: objetivo a muy largo plazo, con habilidades especiales. */
  legendary?: boolean;
  /** Rasgo en una frase. */
  trait: string;
  apply(stats: Stats): void;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'wanderer',
    name: 'Errante',
    sprite: 'hero',
    price: 0,
    weapon: 'spark',
    trait: 'Equilibrado: sin puntos débiles.',
    apply: () => undefined,
  },
  {
    id: 'warden',
    name: 'Guardiana',
    sprite: 'c_warden',
    price: 300,
    weapon: 'lance',
    trait: '+30 % de vida y +1 de armadura, pero un 10 % más lenta.',
    apply: (s) => {
      s.maxHp *= 1.3;
      s.armor += 1;
      s.moveSpeed *= 0.9;
    },
  },
  {
    id: 'mystic',
    name: 'Mística',
    sprite: 'c_mystic',
    price: 700,
    weapon: 'ember',
    trait: '+20 % de área y de duración, pero −20 % de vida.',
    apply: (s) => {
      s.area *= 1.2;
      s.duration *= 1.2;
      s.maxHp *= 0.8;
    },
  },
  {
    id: 'herbalist',
    name: 'Hierbera',
    sprite: 'c_herbalist',
    price: 1_800,
    weapon: 'cloud',
    trait: 'Regenera +0,2 de vida por segundo, pero hace un 15 % menos de daño.',
    apply: (s) => {
      s.regen += 0.2;
      s.might *= 0.85;
    },
  },
  {
    id: 'hunter',
    name: 'Rastreador',
    sprite: 'c_hunter',
    price: 2_600,
    weapon: 'boomerang',
    trait: '+20 % de velocidad de proyectiles y +10 % de crítico, pero −15 % de vida.',
    apply: (s) => {
      s.projSpeed *= 1.2;
      s.critChance += 0.1;
      s.maxHp *= 0.85;
    },
  },
  {
    id: 'gladiator',
    name: 'Gladiadora',
    sprite: 'c_gladiator',
    price: 9_000,
    weapon: 'whip',
    trait: '+15 % de daño, +10 % de vida y +1 de armadura, pero −10 % de área.',
    apply: (s) => {
      s.might *= 1.15;
      s.maxHp *= 1.1;
      s.armor += 1;
      s.area *= 0.9;
    },
  },
  {
    id: 'alchemist',
    name: 'Alquimista',
    sprite: 'c_alchemist',
    price: 12_000,
    weapon: 'flask',
    trait: '+25 % de área y +20 % de oro, pero ataca un 10 % más despacio.',
    apply: (s) => {
      s.area *= 1.25;
      s.greed *= 1.2;
      s.cooldown *= 1.1;
    },
  },
  {
    id: 'stormcaller',
    name: 'Tormentista',
    sprite: 'c_stormcaller',
    price: 19_000,
    weapon: 'storm',
    trait: '+1 proyectil en cada arma, pero −30 % de vida.',
    apply: (s) => {
      s.amount += 1;
      s.maxHp *= 0.7;
    },
  },
  {
    id: 'sapper',
    name: 'Zapador',
    sprite: 'c_sapper',
    price: 40_000,
    weapon: 'mines',
    trait: '+2 de armadura y +10 % de vida, pero un 15 % más lento.',
    apply: (s) => {
      s.armor += 2;
      s.maxHp *= 1.1;
      s.moveSpeed *= 0.85;
    },
  },
  {
    id: 'astronomer',
    name: 'Astrónoma',
    sprite: 'c_astronomer',
    price: 50_000,
    weapon: 'meteors',
    trait: '+25 % de experiencia, pero −25 % de vida.',
    apply: (s) => {
      s.growth *= 1.25;
      s.maxHp *= 0.75;
    },
  },
  {
    id: 'prism',
    name: 'Prismática',
    sprite: 'c_prism',
    price: 85_000,
    weapon: 'beam',
    trait: '+20 % de duración y de velocidad de proyectiles, pero −10 % de daño.',
    apply: (s) => {
      s.duration *= 1.2;
      s.projSpeed *= 1.2;
      s.might *= 0.9;
    },
  },
  {
    id: 'hermit',
    name: 'Ermitaño Lunar',
    sprite: 'c_hermit',
    price: 120_000,
    weapon: 'orbs',
    trait: '+15 % de área y +1 de armadura, pero −15 % de daño.',
    apply: (s) => {
      s.area *= 1.15;
      s.armor += 1;
      s.might *= 0.85;
    },
  },
  {
    id: 'thief',
    name: 'Saqueatumbas',
    sprite: 'c_thief',
    price: 190_000,
    weapon: 'nova',
    trait: '+50 % de oro y +30 % de suerte, pero −25 % de vida.',
    apply: (s) => {
      s.greed *= 1.5;
      s.luck *= 1.3;
      s.maxHp *= 0.75;
    },
  },
  {
    id: 'centella',
    name: 'Centella',
    sprite: 'c_centella',
    price: 230_000,
    weapon: 'spark',
    trait: '+1 proyectil en cada arma y +10 % de velocidad, pero −35 % de vida y ataca un 15 % más despacio.',
    apply: (s) => {
      s.amount += 1;
      s.moveSpeed *= 1.1;
      s.maxHp *= 0.65;
      s.cooldown *= 1.15;
    },
  },
  {
    id: 'knight',
    name: 'Caballero del Alba',
    sprite: 'c_knight',
    price: 300_000,
    weapon: 'lance',
    trait: '+25 % de daño, +15 % de vida y +2 de armadura, pero un 15 % más lento y ataca un 10 % más despacio.',
    apply: (s) => {
      s.might *= 1.25;
      s.maxHp *= 1.15;
      s.armor += 2;
      s.moveSpeed *= 0.85;
      s.cooldown *= 1.1;
    },
  },
  {
    id: 'archmage',
    name: 'Archimaga',
    sprite: 'c_archmage',
    price: 400_000,
    weapon: 'storm',
    trait: '+15 % de daño, de área y de duración y ataca un 10 % más rápido, pero −40 % de vida.',
    apply: (s) => {
      s.might *= 1.15;
      s.area *= 1.15;
      s.duration *= 1.15;
      s.cooldown *= 0.9;
      s.maxHp *= 0.6;
    },
  },
  // ── Legendarios: objetivos de años. Cada uno rompe una regla del juego (revivir, empezar con varias armas…).
  {
    id: 'phoenix',
    name: 'Fénix Renacido',
    sprite: 'c_phoenix',
    price: 750_000,
    legendary: true,
    weapon: 'ember',
    bonusWeapons: ['meteors'],
    trait: 'Revive una vez por partida y empieza también con Lluvia de meteoritos. +10 % de vida y de daño.',
    apply: (s) => {
      s.revival += 1;
      s.maxHp *= 1.1;
      s.might *= 1.1;
    },
  },
  {
    id: 'collector',
    name: 'Coleccionista',
    sprite: 'c_collector',
    price: 1_500_000,
    legendary: true,
    weapon: 'spark',
    bonusWeapons: ['orbs', 'boomerang'],
    trait: 'Empieza con tres armas, +50 % de oro y +30 % de suerte.',
    apply: (s) => {
      s.greed *= 1.5;
      s.luck *= 1.3;
    },
  },
  {
    id: 'chronomancer',
    name: 'Cronomante',
    sprite: 'c_chronomancer',
    price: 4_000_000,
    legendary: true,
    weapon: 'beam',
    bonusWeapons: ['storm'],
    trait: 'Domina el tiempo: ataca un 25 % más rápido, +30 % de duración y +20 % de velocidad de proyectiles. Empieza con dos armas.',
    apply: (s) => {
      s.cooldown *= 0.75;
      s.duration *= 1.3;
      s.projSpeed *= 1.2;
    },
  },
  {
    id: 'sun_avatar',
    name: 'Sol Eterno',
    sprite: 'c_sun_avatar',
    price: 10_000_000,
    legendary: true,
    weapon: 'storm',
    bonusWeapons: ['beam', 'nova', 'meteors'],
    trait: 'El objetivo final: empieza con cuatro armas, revive dos veces, +30 % de daño y de vida, +20 % de área y +1 proyectil.',
    apply: (s) => {
      s.revival += 2;
      s.might *= 1.3;
      s.maxHp *= 1.3;
      s.area *= 1.2;
      s.amount += 1;
    },
  },
];

export const CHARACTER_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));
