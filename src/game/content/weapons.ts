import type { WeaponDef, WeaponStats } from '../sim/types';
import { EVOLUTIONS } from './evolutions';

const MIN_COOLDOWN = 0.15;

/**
 * Armas. Cada una tiene un comportamiento propio en sim/weapons.ts (misma clave `id`);
 * aquí solo están sus números y textos. Niveles 2–8: los `mods` se suman a los valores anteriores.
 * Las evoluciones (content/evolutions.ts) no están en `WEAPONS` (no se ofrecen al subir de nivel), pero sí en `WEAPON_BY_ID`.
 */
export const WEAPONS: WeaponDef[] = [
  {
    id: 'spark',
    name: 'Chispa errante',
    description: 'Dispara al enemigo más cercano.',
    attack: 'Proyectil teledirigido',
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
    attack: 'Proyectil en línea',
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
    attack: 'Órbita',
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
    attack: 'Aura',
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
    attack: 'Rayo en cadena',
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
    attack: 'Explosión de área',
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
  {
    id: 'whip',
    name: 'Látigo de sauce',
    description: 'Fustiga en abanico delante de ti.',
    attack: 'Cuerpo a cuerpo',
    icon: 'w_whip',
    base: { damage: 18, cooldown: 1.1, amount: 1, pierce: 999, area: 52, speed: 0, duration: 0.18, knockback: 40 },
    levels: [
      { text: '+6 de daño', mods: { damage: 6 } },
      { text: 'Otro látigo, también por detrás', mods: { amount: 1 } },
      { text: 'Más alcance', mods: { area: 8 } },
      { text: 'Fustiga más rápido', mods: { cooldown: -0.2 } },
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Otro látigo, a los lados', mods: { amount: 1 } },
      { text: '+10 de daño y más alcance', mods: { damage: 10, area: 10 } },
    ],
  },
  {
    id: 'boomerang',
    name: 'Búmeran de hueso',
    description: 'Sale disparado, atraviesa y vuelve a tu mano.',
    attack: 'Proyectil de ida y vuelta',
    icon: 'w_boomerang',
    base: { damage: 12, cooldown: 1.7, amount: 1, pierce: 999, area: 7, speed: 150, duration: 0.65, knockback: 25 },
    levels: [
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: 'Un búmeran más', mods: { amount: 1 } },
      { text: 'Llega más lejos', mods: { duration: 0.12 } },
      { text: 'Lanza más a menudo', mods: { cooldown: -0.25 } },
      { text: '+6 de daño', mods: { damage: 6 } },
      { text: 'Un búmeran más', mods: { amount: 1 } },
      { text: '+8 de daño y más ancho', mods: { damage: 8, area: 3 } },
    ],
  },
  {
    id: 'mines',
    name: 'Minas de resina',
    description: 'Las sueltas a tu alrededor y estallan al pisarlas.',
    attack: 'Trampa',
    icon: 'w_mine',
    base: { damage: 20, cooldown: 2.6, amount: 1, pierce: 999, area: 36, speed: 0, duration: 10, knockback: 60 },
    levels: [
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Explosión más grande', mods: { area: 6 } },
      { text: 'Una mina más', mods: { amount: 1 } },
      { text: 'Las sueltas más a menudo', mods: { cooldown: -0.4 } },
      { text: '+10 de daño', mods: { damage: 10 } },
      { text: 'Una mina más', mods: { amount: 1 } },
      { text: 'Explosión enorme y +7 de daño', mods: { area: 8, damage: 7 } },
    ],
  },
  {
    id: 'beam',
    name: 'Haz prismático',
    description: 'Un rayo giratorio que corta todo a su paso.',
    attack: 'Rayo giratorio',
    icon: 'w_beam',
    base: { damage: 3, cooldown: 2, amount: 1, pierce: 999, area: 70, speed: 1.6, duration: 2, knockback: 6 },
    levels: [
      { text: '+1 de daño', mods: { damage: 1 } },
      { text: 'Un rayo más', mods: { amount: 1 } },
      { text: 'Rayo más largo', mods: { area: 15 } },
      { text: 'Dura más tiempo', mods: { duration: 0.6 } },
      { text: '+1 de daño y menos descanso', mods: { damage: 1, cooldown: -0.5 } },
      { text: 'Un rayo más', mods: { amount: 1 } },
      { text: '+2 de daño y más largo', mods: { damage: 2, area: 15 } },
    ],
  },
  {
    id: 'meteors',
    name: 'Lluvia de meteoritos',
    description: 'Rocas ardientes caen del cielo sobre tus enemigos.',
    attack: 'Lluvia desde el cielo',
    icon: 'w_meteor',
    base: { damage: 24, cooldown: 4, amount: 2, pierce: 999, area: 38, speed: 0, duration: 0.7, knockback: 70 },
    levels: [
      { text: '+10 de daño', mods: { damage: 10 } },
      { text: 'Un meteorito más', mods: { amount: 1 } },
      { text: 'Impacto más grande', mods: { area: 8 } },
      { text: 'Caen más a menudo', mods: { cooldown: -0.6 } },
      { text: '+12 de daño', mods: { damage: 12 } },
      { text: 'Un meteorito más', mods: { amount: 1 } },
      { text: 'Impacto enorme y +10 de daño', mods: { area: 10, damage: 10 } },
    ],
  },
  {
    id: 'cloud',
    name: 'Nube venenosa',
    description: 'Una nube tóxica que intoxica a quien la cruza.',
    attack: 'Zona persistente',
    icon: 'w_cloud',
    base: { damage: 5, cooldown: 3.2, amount: 1, pierce: 999, area: 40, speed: 0, duration: 4, knockback: 0 },
    levels: [
      { text: '+3 de daño', mods: { damage: 3 } },
      { text: 'Nube más grande', mods: { area: 8 } },
      { text: 'Una nube más', mods: { amount: 1 } },
      { text: 'Se lanza más a menudo', mods: { cooldown: -0.5 } },
      { text: '+4 de daño', mods: { damage: 4 } },
      { text: 'Dura más tiempo', mods: { duration: 1.5 } },
      { text: 'Una nube más y +3 de daño', mods: { amount: 1, damage: 3 } },
    ],
  },
  {
    id: 'nova',
    name: 'Onda de choque',
    description: 'Un pulso que aparta a todos los que te rodean.',
    attack: 'Onda expansiva',
    icon: 'w_nova',
    base: { damage: 20, cooldown: 3, amount: 1, pierce: 999, area: 80, speed: 0, duration: 0, knockback: 140 },
    levels: [
      { text: '+10 de daño', mods: { damage: 10 } },
      { text: 'Pulso más amplio', mods: { area: 12 } },
      { text: 'Pulsa más a menudo', mods: { cooldown: -0.4 } },
      { text: '+12 de daño', mods: { damage: 12 } },
      { text: 'Pulso más amplio', mods: { area: 14 } },
      { text: 'Pulsa más a menudo', mods: { cooldown: -0.4 } },
      { text: '+15 de daño', mods: { damage: 15 } },
    ],
  },
  {
    id: 'ricochet',
    name: 'Cuchillas rebotantes',
    description: 'Rebotan de un enemigo a otro.',
    attack: 'Proyectil rebotante',
    icon: 'x_ricochet',
    // `pierce` = rebotes; `duration` = segundos de vida; `speed` = velocidad de vuelo.
    base: { damage: 11, cooldown: 1.5, amount: 1, pierce: 3, area: 5, speed: 190, duration: 2.5, knockback: 20 },
    levels: [
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: 'Un rebote más', mods: { pierce: 1 } },
      { text: 'Una cuchilla más', mods: { amount: 1 } },
      { text: 'Lanza más a menudo', mods: { cooldown: -0.25 } },
      { text: '+6 de daño', mods: { damage: 6 } },
      { text: 'Dos rebotes más', mods: { pierce: 2 } },
      { text: 'Una cuchilla más y +4 de daño', mods: { amount: 1, damage: 4 } },
    ],
  },
  {
    id: 'drone',
    name: 'Dron centinela',
    description: 'Orbita a tu alrededor y dispara al enemigo más cercano.',
    attack: 'Invocación',
    icon: 'x_drone',
    // `speed` = disparos por segundo; `area` = distancia a la que orbita; `pierce` = enemigos que atraviesa cada disparo;
    // `cooldown` = descanso entre una tanda de drones y la siguiente.
    base: { damage: 11, cooldown: 1.2, amount: 1, pierce: 1, area: 34, speed: 1.2, duration: 6, knockback: 15 },
    levels: [
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: 'Un dron más', mods: { amount: 1 } },
      { text: 'Dispara más rápido', mods: { speed: 0.5 } },
      { text: 'Permanecen más tiempo', mods: { duration: 2 } },
      { text: '+6 de daño', mods: { damage: 6 } },
      { text: 'Un dron más', mods: { amount: 1 } },
      { text: 'Dispara más rápido y +4 de daño', mods: { speed: 0.6, damage: 4 } },
    ],
  },
  {
    id: 'trail',
    name: 'Estela de fuego',
    description: 'Dejas llamas tras de ti que queman a quien las pisa.',
    attack: 'Rastro de daño',
    icon: 'x_flame',
    // `cooldown` = segundos entre llamas; `area` = radio de cada llama; `duration` = lo que dura encendida.
    base: { damage: 4, cooldown: 0.3, amount: 1, pierce: 999, area: 15, speed: 0, duration: 2.2, knockback: 0 },
    levels: [
      { text: '+2 de daño', mods: { damage: 2 } },
      { text: 'Llamas más grandes', mods: { area: 4 } },
      { text: 'Arden más tiempo', mods: { duration: 0.8 } },
      { text: 'Dos llamas a la vez', mods: { amount: 1 } },
      { text: '+3 de daño', mods: { damage: 3 } },
      { text: 'Llamas más grandes', mods: { area: 5 } },
      { text: '+3 de daño y deja más llamas', mods: { damage: 3, cooldown: -0.08 } },
    ],
  },
];

export const WEAPON_BY_ID = new Map([...WEAPONS, ...EVOLUTIONS.map((e) => e.def)].map((w) => [w.id, w]));

/** Comportamiento (clave de `FIRE` en sim/weapons.ts) de un arma: el de su base si es una evolución. */
export const behaviourOf = (id: string) => WEAPON_BY_ID.get(id)?.evolvedFrom ?? id;

/** Valores de un arma en un nivel: los base más los `mods` de cada nivel anterior. */
export function weaponStatsAt(def: WeaponDef, level: number): WeaponStats {
  const stats = { ...def.base };
  for (let i = 0; i < level - 1 && i < def.levels.length; i++) {
    const mods = def.levels[i].mods;
    for (const key in mods) stats[key as keyof WeaponStats] += mods[key as keyof WeaponStats] ?? 0;
  }
  stats.cooldown = Math.max(MIN_COOLDOWN, stats.cooldown);
  return stats;
}
