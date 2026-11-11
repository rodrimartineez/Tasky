import type { WeaponDef } from '../sim/types';

/**
 * Armas. Cada una tiene un comportamiento propio en sim/weapons.ts (misma clave `id`);
 * aquí solo están sus números y textos. Niveles 2–8: los `mods` se suman a los valores anteriores.
 */
export const WEAPONS: WeaponDef[] = [
  {
    id: 'spark',
    name: 'Chispa errante',
    description: 'Dispara al enemigo más cercano.',
    icon: 'w_spark',
    base: { damage: 10, cooldown: 1.1, amount: 1, pierce: 1, area: 4, speed: 170, duration: 1.6, knockback: 30 },
    levels: [
      { text: 'Una chispa más', mods: { amount: 1 } },
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: 'Atraviesa un enemigo más', mods: { pierce: 1 } },
      { text: 'Una chispa más', mods: { amount: 1 } },
      { text: '+5 de daño y dispara más rápido', mods: { damage: 5, cooldown: -0.15 } },
      { text: 'Atraviesa un enemigo más', mods: { pierce: 1 } },
      { text: 'Una chispa más y +5 de daño', mods: { amount: 1, damage: 5 } },
    ],
  },
  {
    id: 'lance',
    name: 'Lanza solar',
    description: 'Vuela hacia donde miras y atraviesa a todos.',
    icon: 'w_lance',
    base: { damage: 14, cooldown: 1.6, amount: 1, pierce: 999, area: 6, speed: 260, duration: 1, knockback: 60 },
    levels: [
      { text: '+6 de daño', mods: { damage: 6 } },
      { text: 'Una lanza más', mods: { amount: 1 } },
      { text: 'Dispara más rápido', mods: { cooldown: -0.2 } },
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Una lanza más', mods: { amount: 1 } },
      { text: 'Lanzas más anchas', mods: { area: 3 } },
      { text: '+10 de daño y más rápida', mods: { damage: 10, cooldown: -0.2 } },
    ],
  },
  {
    id: 'orbs',
    name: 'Lunas guardianas',
    description: 'Giran a tu alrededor y golpean lo que tocan.',
    icon: 'w_orb',
    base: { damage: 8, cooldown: 4.5, amount: 2, pierce: 999, area: 34, speed: 3.4, duration: 3, knockback: 50 },
    levels: [
      { text: 'Una luna más', mods: { amount: 1 } },
      { text: '+4 de daño', mods: { damage: 4 } },
      { text: 'Duran más tiempo', mods: { duration: 0.8 } },
      { text: 'Una luna más', mods: { amount: 1 } },
      { text: 'Órbita más amplia', mods: { area: 8 } },
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: 'Una luna más y duran más', mods: { amount: 1, duration: 1 } },
    ],
  },
  {
    id: 'ember',
    name: 'Aura de ascuas',
    description: 'Quema sin parar a los enemigos cercanos.',
    icon: 'w_ember',
    base: { damage: 4, cooldown: 0.6, amount: 1, pierce: 999, area: 38, speed: 0, duration: 0, knockback: 12 },
    levels: [
      { text: 'Aura más grande', mods: { area: 6 } },
      { text: '+2 de daño', mods: { damage: 2 } },
      { text: 'Quema más a menudo', mods: { cooldown: -0.08 } },
      { text: 'Aura más grande', mods: { area: 8 } },
      { text: '+3 de daño', mods: { damage: 3 } },
      { text: 'Quema más a menudo', mods: { cooldown: -0.08 } },
      { text: 'Aura enorme y +3 de daño', mods: { area: 10, damage: 3 } },
    ],
  },
  {
    id: 'storm',
    name: 'Tormenta en cadena',
    description: 'Un rayo cae sobre un enemigo y salta a los vecinos.',
    icon: 'w_storm',
    base: { damage: 16, cooldown: 2.2, amount: 1, pierce: 2, area: 130, speed: 0, duration: 0, knockback: 0 },
    levels: [
      { text: 'Un salto más', mods: { pierce: 1 } },
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Un rayo más', mods: { amount: 1 } },
      { text: 'Cae más a menudo', mods: { cooldown: -0.3 } },
      { text: 'Un salto más', mods: { pierce: 1 } },
      { text: '+10 de daño', mods: { damage: 10 } },
      { text: 'Un rayo más', mods: { amount: 1 } },
    ],
  },
  {
    id: 'flask',
    name: 'Frasco volátil',
    description: 'Cae sobre un grupo de enemigos y explota.',
    icon: 'w_flask',
    base: { damage: 22, cooldown: 2.8, amount: 1, pierce: 999, area: 30, speed: 0, duration: 0.7, knockback: 80 },
    levels: [
      { text: '+10 de daño', mods: { damage: 10 } },
      { text: 'Explosión más grande', mods: { area: 6 } },
      { text: 'Un frasco más', mods: { amount: 1 } },
      { text: 'Lanza más a menudo', mods: { cooldown: -0.35 } },
      { text: '+12 de daño', mods: { damage: 12 } },
      { text: 'Explosión más grande', mods: { area: 8 } },
      { text: 'Un frasco más', mods: { amount: 1 } },
    ],
  },
];

export const WEAPON_BY_ID = new Map(WEAPONS.map((w) => [w.id, w]));
