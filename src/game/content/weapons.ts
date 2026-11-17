import type { WeaponDef, WeaponStats } from '../sim/types';
import { EVOLUTIONS } from './evolutions';

const MIN_COOLDOWN = 0.15;

/**
 * Armas. Cada una tiene un comportamiento propio en sim/weapons.ts (misma clave `id`);
 * aquí solo están sus números y textos. Niveles 2–7: los `mods` se suman a los valores anteriores.
 * Las evoluciones (content/evolutions.ts) no están en `WEAPONS` (no se ofrecen al subir de nivel), pero sí en `WEAPON_BY_ID`.
 */
export const WEAPONS: WeaponDef[] = [
  {
    id: 'spark',
    name: 'Chispa astral',
    description: 'Dispara al enemigo más cercano.',
    attack: 'Proyectil teledirigido',
    icon: 'w_spark',
    base: { damage: 10, cooldown: 1.1, amount: 1, pierce: 1, area: 4, speed: 170, duration: 1.6, knockback: 30 },
    levels: [
      { text: 'Una chispa más', mods: { amount: 1 } },
      { text: '+12 de daño', mods: { damage: 12 } },
      { text: 'Atraviesa un enemigo más y dispara más rápido', mods: { pierce: 1, cooldown: -0.15 } },
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Atraviesa un enemigo más y vuela más rápida', mods: { pierce: 1, speed: 30 } },
      { text: 'Una chispa más, un enemigo más y +8 de daño', mods: { amount: 1, pierce: 1, damage: 8 } },
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
      { text: '+12 de daño', mods: { damage: 12 } },
      { text: 'Una lanza más', mods: { amount: 1 } },
      { text: 'Dispara más rápido', mods: { cooldown: -0.2 } },
      { text: 'Lanzas más anchas y veloces', mods: { area: 3, speed: 30 } },
      { text: '+12 de daño', mods: { damage: 12 } },
      { text: 'Una lanza más, +7 de daño y más anchas', mods: { amount: 1, damage: 7, area: 3 } },
    ],
  },
  {
    id: 'orbs',
    name: 'Lunas guardianas',
    description: 'Giran a tu alrededor y golpean lo que tocan.',
    attack: 'Órbita',
    icon: 'w_orb',
    base: { damage: 8, cooldown: 4.0, amount: 2, pierce: 999, area: 34, speed: 3.4, duration: 3, knockback: 50 },
    levels: [
      { text: 'Una luna más', mods: { amount: 1 } },
      { text: '+3 de daño', mods: { damage: 3 } },
      { text: 'Duran más tiempo', mods: { duration: 1 } },
      { text: 'Órbita más amplia y más veloz', mods: { area: 8, speed: 0.4 } },
      { text: 'Una luna más y +2 de daño', mods: { amount: 1, damage: 2 } },
      { text: 'Una luna más, +3 de daño y mas frecuencia', mods: { amount: 1, damage: 3, cooldown: -0.8 } },
    ],
  },
  {
    id: 'ember',
    name: 'Aura de ascuas',
    description: 'Quema sin parar a los enemigos que entran en su área.',
    attack: 'Aura',
    icon: 'w_ember',
    base: { damage: 4, cooldown: 0.6, amount: 1, pierce: 999, area: 38, speed: 0, duration: 0, knockback: 12 },
    levels: [
      { text: 'Aura más grande', mods: { area: 6 } },
      { text: '+2 de daño', mods: { damage: 2 } },
      { text: 'Quema más a menudo', mods: { cooldown: -0.08 } },
      { text: 'Aura más grande', mods: { area: 8 } },
      { text: '+2 de daño y quema más a menudo', mods: { damage: 2, cooldown: -0.08 } },
      { text: 'Aura enorme, +2 de daño y quema mucho más a menudo', mods: { area: 10, damage: 2, cooldown: -0.08 } },
    ],
  },
  {
    id: 'storm',
    name: 'Tormenta en cadena',
    description: 'Un rayo cae sobre un enemigo y ataca a los enemigos cercanos.',
    attack: 'Rayo en cadena',
    icon: 'w_storm',
    base: { damage: 16, cooldown: 2.2, amount: 1, pierce: 2, area: 130, speed: 0, duration: 0, knockback: 0 },
    levels: [
      { text: 'Más saltos', mods: { pierce: 1 } },
      { text: '+12 de daño', mods: { damage: 12 } },
      { text: 'Un rayo más', mods: { amount: 1 } },
      { text: 'Cae más a menudo', mods: { cooldown: -0.2 } },
      { text: 'Un salto más y mayor área', mods: { pierce: 1, area: 25 } },
      { text: 'Un rayo más, un salto más y +9 de daño', mods: { amount: 1, pierce: 1, damage: 9 } },
    ],
  },
  {
    id: 'flask',
    name: 'Frasco ígneo',
    description: 'Cae sobre un grupo de enemigos y explota.',
    attack: 'Explosión de área',
    icon: 'w_flask',
    base: { damage: 22, cooldown: 2.8, amount: 2, pierce: 999, area: 30, speed: 0, duration: 1.2, knockback: 80 },
    levels: [
      { text: '+16 de daño', mods: { damage: 16 } },
      { text: 'Explosión más grande', mods: { area: 6 } },
      { text: 'Dos frascos más', mods: { amount: 2 } },
      { text: 'Lanza más a menudo', mods: { cooldown: -0.35 } },
      { text: 'Explosión más grande y +4 de daño', mods: { area: 8, damage: 4 } },
      { text: 'Un frasco más, lanza más a menudo y +4 de daño', mods: { amount: 1, cooldown: -0.15, damage: 4 } },
    ],
  },
  {
    id: 'whip',
    name: 'Látigo de espinas',
    description: 'Ataca a los enemigos cercanos delante tuyo.',
    attack: 'Cuerpo a cuerpo',
    icon: 'w_whip',
    base: { damage: 18, cooldown: 1.1, amount: 1, pierce: 999, area: 52, speed: 0, duration: 0.25, knockback: 40 },
    levels: [
      { text: '+14 de daño', mods: { damage: 14 } },
      { text: 'Otro látigo, también por detrás', mods: { amount: 1 } },
      { text: 'Más alcance', mods: { area: 8 } },
      { text: 'Fustiga más rápido', mods: { cooldown: -0.15 } },
      { text: '+10 de daño y más alcance', mods: { damage: 10, area: 6 } },
      { text: 'Otro látigo, a los lados, y +7 de daño', mods: { amount: 1, damage: 7, area: 10 } },
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
      { text: '+11 de daño', mods: { damage: 11 } },
      { text: 'Un búmeran más', mods: { amount: 1 } },
      { text: 'Llega más lejos y más ancho', mods: { duration: 0.12, area: 2 } },
      { text: 'Lanza más a menudo', mods: { cooldown: -0.25 } },
      { text: '+7 de daño y vuela más rápido', mods: { damage: 7, speed: 20 } },
      { text: 'Un búmeran más, +4 de daño y más ancho', mods: { amount: 1, damage: 4, area: 3 } },
    ],
  },
  {
    id: 'mines',
    name: 'Minas de azufre',
    description: 'Las sueltas a tu alrededor y estallan al pisarlas.',
    attack: 'Trampa',
    icon: 'w_mine',
    base: { damage: 20, cooldown: 2.6, amount: 2, pierce: 999, area: 36, speed: 0, duration: 10, knockback: 60 },
    levels: [
      { text: '+18 de daño', mods: { damage: 18 } },
      { text: 'Explosión más grande', mods: { area: 6 } },
      { text: 'Una mina más', mods: { amount: 1 } },
      { text: 'Las sueltas más a menudo', mods: { cooldown: -0.25 } },
      { text: 'Explosión más grande y las sueltas más a menudo', mods: { area: 6, cooldown: -0.15 } },
      { text: 'Una mina más, +7 de daño y explosión enorme', mods: { amount: 1, damage: 7, area: 8 } },
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
      { text: '+3 de daño', mods: { damage: 3 } },
      { text: 'Un rayo más', mods: { amount: 1 } },
      { text: 'Rayo más largo', mods: { area: 15 } },
      { text: 'Dura más y descansa menos', mods: { duration: 0.8, cooldown: -0.1 } },
      { text: '+3 de daño y gira más rápido', mods: { damage: 3, speed: 0.3 } },
      { text: 'Un rayo más, más largo y menos descanso', mods: { amount: 1, area: 15, cooldown: -0.2 } },
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
      { text: '+18 de daño', mods: { damage: 18 } },
      { text: 'Un meteorito más', mods: { amount: 1 } },
      { text: 'Impacto más grande', mods: { area: 8 } },
      { text: 'Caen más a menudo', mods: { cooldown: -0.4 } },
      { text: 'Un meteorito más e impacto mayor', mods: { amount: 1, area: 6 } },
      { text: 'Un meteorito más, +9 de daño y caen más a menudo', mods: { amount: 1, damage: 9, cooldown: -0.3 } },
    ],
  },
  {
    id: 'cloud',
    name: 'Nube venenosa',
    description: 'Una nube tóxica que intoxica a quien la cruza.',
    attack: 'Zona persistente',
    icon: 'w_cloud',
    base: { damage: 5, cooldown: 3.2, amount: 2, pierce: 999, area: 40, speed: 0, duration: 4, knockback: 0 },
    levels: [
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Nube más grande', mods: { area: 8 } },
      { text: 'Una nube más', mods: { amount: 1 } },
      { text: 'Se lanza más a menudo', mods: { cooldown: -0.4 } },
      { text: 'Dura más tiempo', mods: { duration: 1 } },
      { text: '+6 de daño, nube enorme y dura más', mods: { damage: 6, area: 10, duration: 1 } },
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
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Pulso más amplio', mods: { area: 12 } },
      { text: 'Pulsa más a menudo', mods: { cooldown: -0.3 } },
      { text: '+10 de daño', mods: { damage: 10 } },
      { text: 'Pulso más amplio y pulsa más a menudo', mods: { area: 14, cooldown: -0.3 } },
      { text: '+21 de daño, pulso enorme y pulsa más a menudo', mods: { damage: 21, area: 16, cooldown: -0.3 } },
    ],
  },
  {
    id: 'ricochet',
    name: 'Cuchillas rebotantes',
    description: 'Rebotan de un enemigo a otro.',
    attack: 'Proyectil rebotante',
    icon: 'w_ricochet',
    // `pierce` = rebotes; `duration` = segundos de vida; `speed` = velocidad de vuelo.
    base: { damage: 11, cooldown: 1.5, amount: 1, pierce: 3, area: 5, speed: 190, duration: 2.5, knockback: 20 },
    levels: [
      { text: '+11 de daño', mods: { damage: 11 } },
      { text: 'Un rebote más', mods: { pierce: 1 } },
      { text: 'Una cuchilla más', mods: { amount: 1 } },
      { text: 'Lanza más a menudo', mods: { cooldown: -0.2 } },
      { text: 'Dos rebotes más y más veloces', mods: { pierce: 2, speed: 20 } },
      { text: 'Una cuchilla más, +7 de daño y un rebote más', mods: { amount: 1, damage: 7, pierce: 1 } },
    ],
  },
  {
    id: 'drone',
    name: 'Dron centinela',
    description: 'Orbita a tu alrededor y dispara al enemigo más cercano.',
    attack: 'Invocación',
    icon: 'w_drone',
    // `speed` = disparos por segundo; `area` = distancia a la que orbita; `pierce` = enemigos que atraviesa cada disparo;
    // `cooldown` = descanso entre una tanda de drones y la siguiente.
    base: { damage: 11, cooldown: 1.2, amount: 1, pierce: 1, area: 34, speed: 1.2, duration: 6, knockback: 15 },
    levels: [
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Un dron más', mods: { amount: 1 } },
      { text: 'Dispara más rápido', mods: { speed: 0.15 } },
      { text: 'Permanecen más tiempo y atraviesan un enemigo más', mods: { duration: 2, pierce: 1 } },
      { text: '+8 de daño y dispara más rápido', mods: { damage: 8, speed: 0.15 } },
      { text: '+4 de daño, dispara más rápido y vuelven antes', mods: { damage: 4, speed: 0.3, cooldown: -0.3 } },
    ],
  },
  {
    id: 'trail',
    name: 'Estela de fuego',
    description: 'Dejas llamas tras de ti que queman a quien las pisa.',
    attack: 'Rastro de daño',
    icon: 'w_flame',
    // `cooldown` = segundos entre llamas; `area` = radio de cada llama; `duration` = lo que dura encendida.
    base: { damage: 4, cooldown: 0.3, amount: 1, pierce: 999, area: 15, speed: 0, duration: 2.2, knockback: 0 },
    levels: [
      { text: '+3 de daño', mods: { damage: 3 } },
      { text: 'Llamas más grandes', mods: { area: 4 } },
      { text: 'Arden más tiempo', mods: { duration: 0.8 } },
      { text: 'Dos llamas a la vez y +3 de daño', mods: { amount: 1, damage: 3 } },
      { text: 'Llamas más grandes y arden más', mods: { area: 5, duration: 0.6 } },
      { text: '+3 de daño, más llamas y más grandes', mods: { damage: 3, cooldown: -0.08, area: 5 } },
    ],
  },
  // ── Catálogo del género (17/11/2026): mismas funciones y recetas, identidad propia ─────────────
  {
    id: 'axe',
    name: 'Segur giratoria',
    description: 'Sale lanzada hacia arriba y cae en arco, atravesando a los enemigos.',
    attack: 'Proyectil en arco',
    icon: 'w_axe',
    // `speed` = impulso hacia arriba; `pierce` = enemigos que atraviesa; `duration` = segundos de vuelo.
    base: { damage: 20, cooldown: 1.8, amount: 1, pierce: 4, area: 7, speed: 150, duration: 1.6, knockback: 30 },
    levels: [
      { text: 'Una segur más', mods: { amount: 1 } },
      { text: '+12 de daño', mods: { damage: 12 } },
      { text: 'Atraviesa tres enemigos más y es más grande', mods: { pierce: 3, area: 2 } },
      { text: 'Una segur más', mods: { amount: 1 } },
      { text: '+10 de daño', mods: { damage: 10 } },
      { text: 'Atraviesa tres enemigos más y +8 de daño', mods: { pierce: 3, damage: 8 } },
    ],
  },
  {
    id: 'firewand',
    name: 'Cetro de brasas',
    description: 'Lanza bolas de fuego lentas y potentes contra enemigos al azar.',
    attack: 'Proyectil a un enemigo al azar',
    icon: 'w_firewand',
    base: { damage: 22, cooldown: 2.4, amount: 1, pierce: 1, area: 6, speed: 120, duration: 2, knockback: 40 },
    levels: [
      { text: '+10 de daño', mods: { damage: 10 } },
      { text: 'Una bola de fuego más', mods: { amount: 1 } },
      { text: '+10 de daño y vuelan más rápido', mods: { damage: 10, speed: 20 } },
      { text: 'Una bola de fuego más', mods: { amount: 1 } },
      { text: '+10 de daño', mods: { damage: 10 } },
      { text: 'Una bola de fuego más y +8 de daño', mods: { amount: 1, damage: 8 } },
    ],
  },
  {
    id: 'pentagram',
    name: 'Sello del vacío',
    description: 'De vez en cuando borra a los enemigos de la pantalla, y también la experiencia del suelo.',
    attack: 'Limpieza de pantalla',
    icon: 'w_pentagram',
    // Borra a los enemigos normales; a élites y jefes solo les hace `damage`. `area` = radio que abarca.
    base: { damage: 30, cooldown: 45, amount: 1, pierce: 999, area: 170, speed: 0, duration: 0, knockback: 0 },
    levels: [
      { text: 'Se activa antes', mods: { cooldown: -5 } },
      { text: 'Se activa antes', mods: { cooldown: -5 } },
      { text: 'Abarca más', mods: { area: 20 } },
      { text: 'Se activa antes', mods: { cooldown: -5 } },
      { text: '+30 de daño a élites y jefes', mods: { damage: 30 } },
      { text: 'Se activa antes', mods: { cooldown: -5 } },
    ],
  },
  {
    id: 'dove',
    name: 'Paloma de tiza',
    description: 'Vuela en círculos amplios a tu alrededor soltando bombas.',
    attack: 'Bombardeo en órbita',
    icon: 'w_dove',
    // `area` = radio de su vuelo; `speed` = bombas por segundo; `duration` = segundos en vuelo antes de descansar.
    base: { damage: 12, cooldown: 0.5, amount: 1, pierce: 0, area: 72, speed: 1.2, duration: 10, knockback: 20 },
    levels: [
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: 'Suelta bombas más a menudo', mods: { speed: 0.3 } },
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: 'Suelta bombas más a menudo', mods: { speed: 0.3 } },
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: '+3 de daño y bombas mucho más a menudo', mods: { damage: 3, speed: 0.4 } },
    ],
  },
  {
    id: 'raven',
    name: 'Cuervo de tinta',
    description: 'Vuela en círculos cerrados a tu alrededor, en sentido contrario, soltando bombas.',
    attack: 'Bombardeo en órbita',
    icon: 'w_raven',
    base: { damage: 10, cooldown: 0.5, amount: 1, pierce: 0, area: 46, speed: 1.2, duration: 10, knockback: 20 },
    levels: [
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: 'Suelta bombas más a menudo', mods: { speed: 0.3 } },
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: 'Suelta bombas más a menudo', mods: { speed: 0.3 } },
      { text: '+5 de daño', mods: { damage: 5 } },
      { text: '+3 de daño y bombas mucho más a menudo', mods: { damage: 3, speed: 0.4 } },
    ],
  },
  {
    id: 'cardinal',
    name: 'Revólver de la rosa',
    description: 'Dispara hacia delante y, con cada nivel, también hacia atrás y a los lados.',
    attack: 'Disparos en cruz',
    icon: 'w_cardinal',
    base: { damage: 10, cooldown: 1.2, amount: 1, pierce: 2, area: 4, speed: 220, duration: 1.2, knockback: 10 },
    levels: [
      { text: 'También dispara hacia atrás', mods: { amount: 1 } },
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'También dispara a un lado', mods: { amount: 1 } },
      { text: 'Dispara más rápido', mods: { cooldown: -0.2 } },
      { text: 'Dispara en las cuatro direcciones', mods: { amount: 1 } },
      { text: '+8 de daño y atraviesa un enemigo más', mods: { damage: 8, pierce: 1 } },
    ],
  },
  {
    id: 'saltire',
    name: 'Revólver del aspa',
    description: 'Dispara en dos diagonales opuestas y, con cada nivel, en más.',
    attack: 'Disparos en aspa',
    icon: 'w_saltire',
    base: { damage: 10, cooldown: 1.2, amount: 2, pierce: 2, area: 4, speed: 220, duration: 1.2, knockback: 10 },
    levels: [
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Una diagonal más', mods: { amount: 1 } },
      { text: 'Dispara más rápido', mods: { cooldown: -0.2 } },
      { text: 'Dispara en las cuatro diagonales', mods: { amount: 1 } },
      { text: '+8 de daño y atraviesa un enemigo más', mods: { damage: 8, pierce: 1 } },
      { text: '+6 de daño y dispara más rápido', mods: { damage: 6, cooldown: -0.1 } },
    ],
  },
  {
    id: 'cats',
    name: 'Gatos callejeros',
    description: 'Gatos que vagan a su aire y arañan a los enemigos que se cruzan.',
    attack: 'Invocación errante',
    icon: 'w_cats',
    // `area` = radio de contacto; `speed` = velocidad al vagar; `duration` = segundos que se quedan.
    base: { damage: 12, cooldown: 3, amount: 1, pierce: 0, area: 8, speed: 40, duration: 6, knockback: 20 },
    levels: [
      { text: 'Un gato más', mods: { amount: 1 } },
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Se quedan más tiempo', mods: { duration: 2 } },
      { text: 'Un gato más', mods: { amount: 1 } },
      { text: '+8 de daño y gatos más grandes', mods: { damage: 8, area: 2 } },
      { text: 'Un gato más y se quedan más tiempo', mods: { amount: 1, duration: 2 } },
    ],
  },
  {
    id: 'mana',
    name: 'Pilar lunar',
    description: 'Una columna vertical de luz a tu alrededor que daña a todo lo que hay dentro.',
    attack: 'Columna vertical',
    icon: 'w_mana',
    // `area` = media anchura de la columna; `duration` = segundos que dura (daña cada 0,3 s).
    base: { damage: 14, cooldown: 2.5, amount: 1, pierce: 0, area: 16, speed: 0, duration: 1, knockback: 0 },
    levels: [
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Columna más ancha', mods: { area: 4 } },
      { text: 'Dura más', mods: { duration: 0.5 } },
      { text: '+8 de daño', mods: { damage: 8 } },
      { text: 'Más ancha y más a menudo', mods: { area: 4, cooldown: -0.3 } },
      { text: 'Una columna más y +5 de daño', mods: { amount: 1, damage: 5 } },
    ],
  },
  {
    id: 'clock',
    name: 'Saeta del reloj',
    description: 'Dispara saetas de hielo que congelan a los enemigos, girando como las agujas de un reloj.',
    attack: 'Congelación giratoria',
    icon: 'w_clock',
    base: { damage: 4, cooldown: 2, amount: 1, pierce: 999, area: 5, speed: 200, duration: 1.2, knockback: 0 },
    levels: [
      { text: 'Dispara más a menudo', mods: { cooldown: -0.2 } },
      { text: '+4 de daño', mods: { damage: 4 } },
      { text: 'Una saeta más', mods: { amount: 1 } },
      { text: 'Dispara más a menudo', mods: { cooldown: -0.2 } },
      { text: 'Saetas más anchas', mods: { area: 3 } },
      { text: 'Dispara mucho más a menudo', mods: { cooldown: -0.3 } },
    ],
  },
  {
    id: 'laurel',
    name: 'Égida de hiedra',
    description: 'Cada cierto tiempo te envuelve en un escudo que bloquea todo el daño.',
    attack: 'Escudo',
    icon: 'w_laurel',
    // `duration` = segundos de escudo; no hace daño.
    base: { damage: 0, cooldown: 10, amount: 1, pierce: 0, area: 0, speed: 0, duration: 1, knockback: 0 },
    levels: [
      { text: 'Se renueva antes', mods: { cooldown: -1 } },
      { text: 'Escudo más duradero', mods: { duration: 0.4 } },
      { text: 'Se renueva antes', mods: { cooldown: -1 } },
      { text: 'Escudo más duradero', mods: { duration: 0.4 } },
      { text: 'Se renueva antes', mods: { cooldown: -1 } },
      { text: 'Escudo mucho más duradero', mods: { duration: 0.6 } },
    ],
  },
  {
    id: 'vento',
    name: 'Filo errante',
    description: 'Mientras te mueves, corta hacia delante; cuanto más corres, más fuerte golpea.',
    attack: 'Cuerpo a cuerpo en movimiento',
    icon: 'w_vento',
    base: { damage: 10, cooldown: 0.5, amount: 1, pierce: 999, area: 44, speed: 0, duration: 0.2, knockback: 20 },
    levels: [
      { text: '+6 de daño', mods: { damage: 6 } },
      { text: 'Más alcance', mods: { area: 6 } },
      { text: 'Corta más rápido', mods: { cooldown: -0.08 } },
      { text: '+6 de daño', mods: { damage: 6 } },
      { text: 'Más alcance', mods: { area: 6 } },
      { text: 'También corta hacia atrás y +8 de daño', mods: { amount: 1, damage: 8 } },
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

/** Familia de elemento de cada arma base (ARTE_GUIA.md): da el color y el impacto animado. */
const FAMILY: Record<string, 'fire' | 'lightning' | 'arcane' | 'poison' | 'steel'> = {
  ember: 'fire',
  meteors: 'fire',
  trail: 'fire',
  spark: 'lightning',
  storm: 'lightning',
  beam: 'lightning',
  orbs: 'arcane',
  nova: 'arcane',
  ricochet: 'arcane',
  flask: 'poison',
  cloud: 'poison',
  mines: 'poison',
  lance: 'steel',
  whip: 'steel',
  boomerang: 'steel',
  drone: 'steel',
  axe: 'steel',
  firewand: 'fire',
  pentagram: 'arcane',
  dove: 'arcane',
  raven: 'arcane',
  cardinal: 'fire',
  saltire: 'lightning',
  cats: 'steel',
  mana: 'arcane',
  clock: 'lightning',
  vento: 'steel',
};

/** Impacto animado de un arma (o de su evolución): `fx_<familia>_hit`. */
export function hitFxOf(id: string): string | undefined {
  const family = FAMILY[behaviourOf(id)];
  return family && `fx_${family}_hit`;
}
