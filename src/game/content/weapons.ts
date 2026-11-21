import type { WeaponDef, WeaponLevel, WeaponStats } from '../sim/types';
import { EVOLUTIONS } from './evolutions';

const MIN_COOLDOWN = 0.15;

const L = (text: string, mods: Partial<WeaponStats>): WeaponLevel => ({ text, mods });
const s = (stats: Partial<WeaponStats>): WeaponStats => ({ damage: 0, cooldown: 1, amount: 1, pierce: 999, area: 0, speed: 0, duration: 0, knockback: 0, ...stats });

/**
 * Catálogo cerrado de armas (17/11/2026). Mecánicas de referencia: las del género (Vampire Survivors), con nombres,
 * arte y efectos propios de Tasky. Cada arma tiene un comportamiento propio en sim/weapons.ts (misma clave `id`); aquí
 * solo están sus números y textos. Cada entrada de `levels` es un nivel más (su máximo es `levels.length + 1`) y sus
 * `mods` se suman a los valores anteriores. Conversión desde la referencia: daño ×1,6 y tiempo entre ataques ×0,75 (las
 * partidas de Tasky duran la mitad); `area` en píxeles (radio, alcance o media anchura) y `speed` en píxeles/s.
 * Las evoluciones (content/evolutions.ts) no están en `WEAPONS` (no se ofrecen al subir de nivel), pero sí en `WEAPON_BY_ID`.
 */
export const WEAPONS: WeaponDef[] = [
  {
    id: 'whip',
    name: 'Látigo',
    description: 'Azota en horizontal hacia donde miras; atraviesa a todos.',
    attack: 'Cuerpo a cuerpo horizontal',
    icon: 'w_whip',
    base: s({ damage: 16, cooldown: 1, area: 52, duration: 0.25, knockback: 40 }),
    levels: [
      L('Otro latigazo, también por detrás', { amount: 1 }),
      L('+8 de daño', { damage: 8 }),
      L('+15 % de alcance y +8 de daño', { area: 8, damage: 8 }),
      L('+8 de daño', { damage: 8 }),
      L('+15 % de alcance y +8 de daño', { area: 8, damage: 8 }),
      L('+8 de daño', { damage: 8 }),
      L('+15 % de alcance y +8 de daño', { area: 8, damage: 8 }),
    ],
  },
  {
    id: 'spark',
    name: 'Varita Mágica',
    description: 'Dispara uno tras otro al enemigo más cercano.',
    attack: 'Proyectil al más cercano',
    icon: 'w_spark',
    interval: 0.1,
    base: s({ damage: 16, cooldown: 0.9, pierce: 1, area: 4, speed: 170, duration: 1.6, knockback: 20 }),
    levels: [
      L('Un proyectil más', { amount: 1 }),
      L('Dispara más a menudo', { cooldown: -0.15 }),
      L('Un proyectil más', { amount: 1 }),
      L('+16 de daño', { damage: 16 }),
      L('Un proyectil más', { amount: 1 }),
      L('Atraviesa un enemigo más', { pierce: 1 }),
      L('+16 de daño', { damage: 16 }),
    ],
  },
  {
    id: 'lance',
    name: 'Cuchillo',
    description: 'Lanza cuchillos rápidos, en ráfaga, hacia donde miras.',
    attack: 'Ráfaga en línea',
    icon: 'w_lance',
    interval: 0.1,
    base: s({ damage: 10, cooldown: 0.75, pierce: 1, area: 4, speed: 300, duration: 1, knockback: 15 }),
    levels: [
      L('Un cuchillo más', { amount: 1 }),
      L('Un cuchillo más y +8 de daño', { amount: 1, damage: 8 }),
      L('Un cuchillo más', { amount: 1 }),
      L('Atraviesa un enemigo más', { pierce: 1 }),
      L('Un cuchillo más', { amount: 1 }),
      L('Un cuchillo más y +8 de daño', { amount: 1, damage: 8 }),
      L('Atraviesa un enemigo más', { pierce: 1 }),
    ],
  },
  {
    id: 'axe',
    name: 'Hacha',
    description: 'Sube en arco y cae por su peso, atravesando lo que encuentra.',
    attack: 'Proyectil en parábola',
    icon: 'w_axe',
    interval: 0.2,
    base: s({ damage: 32, cooldown: 3, pierce: 3, area: 7, speed: 170, duration: 2, knockback: 30 }),
    levels: [
      L('Un hacha más', { amount: 1 }),
      L('+32 de daño', { damage: 32 }),
      L('Atraviesa dos enemigos más', { pierce: 2 }),
      L('Un hacha más', { amount: 1 }),
      L('+32 de daño', { damage: 32 }),
      L('Atraviesa dos enemigos más', { pierce: 2 }),
      L('+32 de daño', { damage: 32 }),
    ],
  },
  {
    id: 'boomerang',
    name: 'Cruz',
    description: 'Vuela hacia el enemigo más cercano y vuelve como un bumerán.',
    attack: 'Proyectil de ida y vuelta',
    icon: 'w_boomerang',
    interval: 0.1,
    base: s({ damage: 8, cooldown: 1.5, area: 7, speed: 150, duration: 0.65, knockback: 25 }),
    levels: [
      L('+10 de daño', { damage: 10 }),
      L('+10 % de tamaño y de velocidad', { area: 1, speed: 15 }),
      L('Una cruz más', { amount: 1 }),
      L('+10 de daño', { damage: 10 }),
      L('+10 % de tamaño y +25 % de velocidad', { area: 1, speed: 38 }),
      L('Una cruz más', { amount: 1 }),
      L('+10 de daño', { damage: 10 }),
    ],
  },
  {
    id: 'orbs',
    name: 'Biblia del Rey',
    description: 'Libros que giran a tu alrededor un tiempo y golpean lo que tocan.',
    attack: 'Órbita',
    icon: 'w_orb',
    base: s({ damage: 16, cooldown: 3, area: 34, speed: 3.4, duration: 3, knockback: 50 }),
    levels: [
      L('Un libro más', { amount: 1 }),
      L('+25 % de velocidad y de radio', { speed: 0.85, area: 8.5 }),
      L('Duran 0,5 s más y +16 de daño', { duration: 0.5, damage: 16 }),
      L('Un libro más', { amount: 1 }),
      L('+25 % de velocidad y de radio', { speed: 0.85, area: 8.5 }),
      L('Duran 0,5 s más y +16 de daño', { duration: 0.5, damage: 16 }),
      L('Un libro más', { amount: 1 }),
    ],
  },
  {
    id: 'firewand',
    name: 'Varita Ígnea',
    description: 'Bolas de fuego potentes contra enemigos al azar.',
    attack: 'Proyectil a un enemigo al azar',
    icon: 'w_firewand',
    base: s({ damage: 32, cooldown: 2.25, amount: 3, pierce: 1, area: 6, speed: 110, duration: 2, knockback: 40 }),
    levels: [
      L('+16 de daño', { damage: 16 }),
      L('+16 de daño y +20 % de velocidad', { damage: 16, speed: 22 }),
      L('+16 de daño', { damage: 16 }),
      L('+16 de daño y +20 % de velocidad', { damage: 16, speed: 22 }),
      L('+16 de daño', { damage: 16 }),
      L('+16 de daño y +20 % de velocidad', { damage: 16, speed: 22 }),
      L('+16 de daño', { damage: 16 }),
    ],
  },
  {
    id: 'ember',
    name: 'Ajo',
    description: 'Daña sin parar a los enemigos que se te acercan y los aparta.',
    attack: 'Aura',
    icon: 'w_ember',
    base: s({ damage: 8, cooldown: 1, area: 38, knockback: 12 }),
    levels: [
      L('+20 % de área y +3 de daño', { area: 7.6, damage: 3 }),
      L('Daña más a menudo y +2 de daño', { cooldown: -0.075, damage: 2 }),
      L('+20 % de área y +2 de daño', { area: 7.6, damage: 2 }),
      L('Daña más a menudo y +3 de daño', { cooldown: -0.075, damage: 3 }),
      L('+20 % de área y +2 de daño', { area: 7.6, damage: 2 }),
      L('Daña más a menudo y +2 de daño', { cooldown: -0.075, damage: 2 }),
      L('+20 % de área y +2 de daño', { area: 7.6, damage: 2 }),
    ],
  },
  {
    id: 'cloud',
    name: 'Agua Bendita',
    description: 'Arroja frascos que dejan charcos sagrados que dañan a quien los pisa.',
    attack: 'Charco de daño',
    icon: 'w_cloud',
    interval: 0.3,
    base: s({ damage: 11, cooldown: 3.4, area: 32, duration: 2 }),
    levels: [
      L('Un frasco más', { amount: 1 }),
      L('+20 % de área y +10 de daño', { area: 6.4, damage: 10 }),
      L('Un frasco más y duran 0,5 s más', { amount: 1, duration: 0.5 }),
      L('+10 de daño y +20 % de área', { damage: 10, area: 6.4 }),
      L('Un frasco más', { amount: 1 }),
      L('+10 de daño y duran 0,5 s más', { damage: 10, duration: 0.5 }),
      L('+20 % de área y +6 de daño', { area: 6.4, damage: 6 }),
    ],
  },
  {
    id: 'ricochet',
    name: 'Runa Trazadora',
    description: 'Una runa que atraviesa a todos y rebota en los bordes de la pantalla.',
    attack: 'Rebote en los bordes',
    icon: 'w_ricochet',
    base: s({ damage: 16, cooldown: 2.25, area: 5, speed: 190, duration: 2.25, knockback: 20 }),
    levels: [
      L('+8 de daño y +20 % de velocidad', { damage: 8, speed: 38 }),
      L('+8 de daño y dura 0,3 s más', { damage: 8, duration: 0.3 }),
      L('Una runa más', { amount: 1 }),
      L('+8 de daño y +20 % de velocidad', { damage: 8, speed: 38 }),
      L('+8 de daño y dura 0,3 s más', { damage: 8, duration: 0.3 }),
      L('Una runa más', { amount: 1 }),
      L('Dura 0,5 s más', { duration: 0.5 }),
    ],
  },
  {
    id: 'storm',
    name: 'Anillo Relámpago',
    description: 'Rayos que caen sobre enemigos al azar y dañan a su alrededor.',
    attack: 'Rayo del cielo',
    icon: 'w_storm',
    base: s({ damage: 24, cooldown: 3.4, amount: 2, area: 14 }),
    levels: [
      L('Un rayo más', { amount: 1 }),
      L('Doble de área y +16 de daño', { area: 14, damage: 16 }),
      L('Un rayo más', { amount: 1 }),
      L('+50 % de área y +32 de daño', { area: 14, damage: 32 }),
      L('Un rayo más', { amount: 1 }),
      L('+33 % de área y +32 de daño', { area: 14, damage: 32 }),
      L('Un rayo más', { amount: 1 }),
    ],
  },
  {
    id: 'pentagram',
    name: 'Pentáculo',
    description: 'De vez en cuando borra a los enemigos de la pantalla, y también la experiencia del suelo.',
    attack: 'Limpieza de pantalla',
    icon: 'w_pentagram',
    // Borra a los enemigos normales; a élites y jefes solo les hace `damage`. `area` = radio que abarca.
    base: s({ damage: 30, cooldown: 60, area: 220 }),
    levels: [
      L('Se activa 5 s antes', { cooldown: -5 }),
      L('Se activa 5 s antes', { cooldown: -5 }),
      L('Se activa 5 s antes', { cooldown: -5 }),
      L('+30 de daño a élites y jefes', { damage: 30 }),
      L('Se activa 5 s antes', { cooldown: -5 }),
      L('Se activa 5 s antes', { cooldown: -5 }),
      L('Se activa 5 s antes', { cooldown: -5 }),
    ],
  },
  {
    id: 'mana',
    name: 'Canción de Maná',
    description: 'Una columna vertical de energía que te sigue y daña todo lo que atraviesa.',
    attack: 'Columna vertical',
    icon: 'w_mana',
    // `area` = media anchura de la columna; ignora los proyectiles extra. Cada enemigo recibe un golpe por segundo.
    base: s({ damage: 16, cooldown: 1.5, area: 12, duration: 0.5 }),
    levels: [
      L('Doble de anchura', { area: 12 }),
      L('Dura 0,5 s más (y tarda algo más en volver)', { duration: 0.5, cooldown: 0.56 }),
      L('+25 % de anchura y +16 de daño', { area: 3, damage: 16 }),
      L('Dura 0,5 s más (y tarda algo más en volver)', { duration: 0.5, cooldown: 0.56 }),
      L('+25 % de anchura y +16 de daño', { area: 3, damage: 16 }),
      L('Dura 0,5 s más (y tarda algo más en volver)', { duration: 0.5, cooldown: 0.56 }),
      L('+25 % de anchura y +16 de daño', { area: 3, damage: 16 }),
    ],
  },
  {
    id: 'clock',
    name: 'Lanceta Temporal',
    description: 'Un haz que congela a los enemigos; cada disparo avanza una hora en la esfera.',
    attack: 'Haz congelante',
    icon: 'w_clock',
    // No hace daño: `duration` = segundos de congelación; `area` = largo del haz.
    base: s({ cooldown: 1.5, area: 190, duration: 2 }),
    levels: [
      L('Congela 1 s más', { duration: 1 }),
      L('Dispara más a menudo', { cooldown: -0.4 }),
      L('Congela 1 s más', { duration: 1 }),
      L('Congela 1 s más', { duration: 1 }),
      L('Dispara más a menudo', { cooldown: -0.4 }),
      L('Congela 1 s más', { duration: 1 }),
    ],
  },
  {
    id: 'laurel',
    name: 'Laurel',
    description: 'Un escudo que absorbe golpes enteros y se recarga con el tiempo.',
    attack: 'Escudo',
    icon: 'w_laurel',
    // `amount` = cargas del escudo; `duration` = invulnerabilidad extra tras gastar una; `cooldown` = recarga.
    base: s({ cooldown: 7.5, amount: 1, pierce: 0 }),
    levels: [
      L('Se recarga antes y protege 0,2 s más', { cooldown: -0.4, duration: 0.2 }),
      L('Se recarga antes y protege 0,2 s más', { cooldown: -0.4, duration: 0.2 }),
      L('Una carga más', { amount: 1 }),
      L('Se recarga antes y protege 0,2 s más', { cooldown: -0.4, duration: 0.2 }),
      L('Se recarga antes y protege 0,2 s más', { cooldown: -0.4, duration: 0.2 }),
      L('Una carga más', { amount: 1 }),
    ],
  },
  {
    id: 'vento',
    name: 'Viento Sacro',
    description: 'Tajos rápidos hacia delante; mientras caminas ataca más a menudo y cada vez más fuerte.',
    attack: 'Cuerpo a cuerpo en movimiento',
    icon: 'w_vento',
    interval: 0.05,
    crit: 0.05,
    base: s({ damage: 3, cooldown: 1.5, amount: 4, area: 44, duration: 0.4, knockback: 5 }),
    levels: [
      L('+2 de daño y +10 % de alcance', { damage: 2, area: 4 }),
      L('Un tajo más y +20 % de alcance', { amount: 1, area: 9 }),
      L('+2 de daño y +10 % de alcance', { damage: 2, area: 4 }),
      L('Un tajo más y +20 % de alcance', { amount: 1, area: 9 }),
      L('+2 de daño y +10 % de alcance', { damage: 2, area: 4 }),
      L('Un tajo más y +20 % de alcance', { amount: 1, area: 9 }),
      L('+2 de daño y +10 % de alcance', { damage: 2, area: 4 }),
    ],
  },
  {
    id: 'victory',
    name: 'Espada de la Victoria',
    description: 'Combos de tajos sobre los enemigos más cercanos; si te golpean, contraataca a tu alrededor.',
    attack: 'Combo de tajos',
    icon: 'w_victory',
    interval: 0.1,
    base: s({ damage: 8, cooldown: 1.4, amount: 2, area: 20, knockback: 5 }),
    levels: [
      L('Un tajo más', { amount: 1 }),
      L('+20 % de área y +8 de daño', { area: 4, damage: 8 }),
      L('Un tajo más', { amount: 1 }),
      L('+20 % de área y +16 de daño', { area: 4, damage: 16 }),
      L('Un tajo más', { amount: 1 }),
      L('+20 % de área y +16 de daño', { area: 4, damage: 16 }),
      L('Críticos y, cada cinco tajos, un remate vertical enorme', {}),
    ],
  },
  {
    id: 'misspell',
    name: 'Llamas de Hechizografía',
    description: 'Una ráfaga de llamaradas en abanico hacia donde caminas.',
    attack: 'Cono de llamas',
    icon: 'w_misspell',
    interval: 0.04,
    base: s({ damage: 16, cooldown: 3, amount: 12, area: 7, speed: 130, duration: 0.4, knockback: 2 }),
    levels: [
      L('+25 % de velocidad', { speed: 32 }),
      L('+16 de daño', { damage: 16 }),
      L('+50 % de área y lanza más a menudo', { area: 3.5, cooldown: -0.375 }),
      L('+25 % de velocidad', { speed: 32 }),
      L('+16 de daño', { damage: 16 }),
      L('+50 % de área y lanza más a menudo', { area: 3.5, cooldown: -0.375 }),
      L('Lanza más a menudo', { cooldown: -0.375 }),
    ],
  },
  {
    id: 'phaser',
    name: 'Fasor',
    description: 'Secuencias de haces horizontales de colores centrados en los enemigos.',
    attack: 'Haz horizontal',
    icon: 'w_phaser',
    interval: 0.1,
    // Cada proyectil son cuatro haces (rojo, amarillo, azul y magenta); `area` = media altura del haz.
    base: s({ damage: 8, cooldown: 3.75, area: 3, knockback: 2 }),
    levels: [
      L('Una secuencia más', { amount: 1 }),
      L('+50 % de grosor y +5 de daño', { area: 1.5, damage: 5 }),
      L('Una secuencia más', { amount: 1 }),
      L('+50 % de grosor y +5 de daño', { area: 1.5, damage: 5 }),
      L('Una secuencia más', { amount: 1 }),
      L('+50 % de grosor y +6 de daño', { area: 1.5, damage: 6 }),
      L('Una secuencia más', { amount: 1 }),
    ],
  },
  {
    id: 'unearthly',
    name: 'Rayo Sobrenatural',
    description: 'Rayos verdes al enemigo más cercano; sus críticos estallan y encadenan daño extra.',
    attack: 'Rayo al más cercano',
    icon: 'w_unearthly',
    interval: 0.1,
    // Críticos (5 % por suerte): no multiplican; estallan en `area` y suman +1 de daño si llegan seguidos.
    base: s({ damage: 16, cooldown: 3, area: 18, duration: 0.1, knockback: 2 }),
    levels: [
      L('Un rayo más', { amount: 1 }),
      L('Un rayo más y +10 % de área', { amount: 1, area: 1.8 }),
      L('Dispara antes y +8 de daño', { cooldown: -0.075, damage: 8 }),
      L('Un rayo más', { amount: 1 }),
      L('Un rayo más y +10 % de área', { amount: 1, area: 1.8 }),
      L('Un rayo más', { amount: 1 }),
      L('Dispara antes y +8 de daño', { cooldown: -0.075, damage: 8 }),
    ],
  },
  {
    id: 'ammo',
    name: 'Munición Espantosa',
    description: 'Ráfagas de balas al enemigo más cercano; si no hay nadie, las guarda para después.',
    attack: 'Ráfaga de balas',
    icon: 'w_ammo',
    interval: 0.1,
    base: s({ damage: 8, cooldown: 1.5, amount: 3, pierce: 1, area: 3, speed: 260, duration: 1.2, knockback: 5 }),
    levels: [
      L('+10 % de tamaño y atraviesa tres más', { area: 0.3, pierce: 3 }),
      L('Una bala más y +2 de daño', { amount: 1, damage: 2 }),
      L('Una bala más y +2 de daño', { amount: 1, damage: 2 }),
      L('+10 % de tamaño y atraviesa tres más', { area: 0.3, pierce: 3 }),
      L('Una bala más y +2 de daño', { amount: 1, damage: 2 }),
      L('+5 de daño', { damage: 5 }),
      L('Dos balas más', { amount: 2 }),
    ],
  },
  {
    id: 'tuna1',
    name: 'Atún Exprés',
    description: 'Forma rápida del Atún Cambiante: lanza un atún al más cercano que estalla en burbujas.',
    attack: 'Proyectil al más cercano',
    icon: 'w_tuna1',
    interval: 0.2,
    base: s({ damage: 16, cooldown: 0.9, pierce: 1, area: 16, speed: 120, duration: 0.4, knockback: 5 }),
    levels: [
      L('+10 % de velocidad', { speed: 15 }),
      L('+16 de daño', { damage: 16 }),
      L('+10 % de velocidad', { speed: 15 }),
      L('Un atún más', { amount: 1 }),
      L('+20 % de velocidad', { speed: 30 }),
    ],
  },
];

/**
 * Formas del Atún Cambiante (referencia: Penshin Fatcha). Solo la primera (`tuna1`, en `WEAPONS`) se ofrece al subir
 * de nivel; cada evolución (sin pasiva) deja elegir una forma ya desbloqueada o la siguiente, que hereda las mejoras
 * de nivel de todas las anteriores. A partir de la sexta evolución se puede elegir el Milagro (todas a la vez).
 */
export const TUNA_FORMS: WeaponDef[] = [
  WEAPONS.find((w) => w.id === 'tuna1')!,
  {
    id: 'tuna2',
    name: 'Atunado',
    description: 'Forma de duración: un remolino con un atún dentro que persigue a los enemigos.',
    attack: 'Remolino',
    icon: 'w_tuna2',
    interval: 0.25,
    base: s({ damage: 16, cooldown: 3, area: 10, speed: 60, duration: 1.75, knockback: 10 }),
    levels: [
      L('Dura 0,25 s más', { duration: 0.25 }),
      L('+16 de daño', { damage: 16 }),
      L('Dura 0,25 s más', { duration: 0.25 }),
      L('+10 % de velocidad', { speed: 6 }),
      L('Dura 0,5 s más', { duration: 0.5 }),
    ],
  },
  {
    id: 'tuna3',
    name: 'Atún Saltarín',
    description: 'Forma de cadencia: atunes que saltan desde abajo y rebotan en los bordes dejando burbujas.',
    attack: 'Salto con rebotes',
    icon: 'w_tuna3',
    interval: 0.1,
    base: s({ damage: 16, cooldown: 3, area: 8, speed: 200, duration: 1.75, knockback: 20 }),
    levels: [
      L('Ataca más a menudo', { cooldown: -0.15 }),
      L('+16 de daño', { damage: 16 }),
      L('Ataca más a menudo', { cooldown: -0.15 }),
      L('Dura 0,25 s más', { duration: 0.25 }),
      L('Ataca mucho más a menudo', { cooldown: -0.3 }),
    ],
  },
  {
    id: 'tuna4',
    name: 'Lluvia de Atunes',
    description: 'Forma de cantidad: atunes que llueven en diagonal y dejan charcos de burbujas.',
    attack: 'Lluvia',
    icon: 'w_tuna4',
    interval: 0.1,
    base: s({ damage: 16, cooldown: 3, amount: 2, area: 16, duration: 1.75, knockback: 10 }),
    levels: [
      L('Un atún más', { amount: 1 }),
      L('+16 de daño', { damage: 16 }),
      L('Un atún más', { amount: 1 }),
      L('+10 % de área', { area: 1.6 }),
      L('Dos atunes más', { amount: 2 }),
    ],
  },
  {
    id: 'tuna5',
    name: 'Atún Colosal',
    description: 'Forma de área: un atún gigante cae dando una voltereta y deja un gran charco.',
    attack: 'Golpe de área',
    icon: 'w_tuna5',
    base: s({ damage: 24, cooldown: 3, area: 40, duration: 1.75, knockback: 10 }),
    levels: [
      L('+10 % de área', { area: 4 }),
      L('Dura 0,25 s más', { duration: 0.25 }),
      L('+10 % de área', { area: 4 }),
      L('+16 de daño', { damage: 16 }),
      L('+20 % de área', { area: 8 }),
    ],
  },
  {
    id: 'tuna6',
    name: 'Atún Insuperable',
    description: 'Forma de daño: atunes dorados que cruzan la pantalla en horizontal arrollándolo todo.',
    attack: 'Embestida horizontal',
    icon: 'w_tuna6',
    interval: 0.25,
    base: s({ damage: 16, cooldown: 3, amount: 2, area: 8, speed: 200, duration: 1.75, knockback: 20 }),
    levels: [
      L('+16 de daño', { damage: 16 }),
      L('+10 % de velocidad', { speed: 20 }),
      L('+16 de daño', { damage: 16 }),
      L('Ataca más a menudo', { cooldown: -0.15 }),
      L('+32 de daño', { damage: 32 }),
    ],
  },
];

export const TUNA_IDS = TUNA_FORMS.map((f) => f.id);

/** Selector de forma y forma combinada: no se ofrecen al subir de nivel ni tienen niveles. */
const TUNA_EXTRAS: WeaponDef[] = [
  {
    id: 'miracle',
    name: 'Milagro del Banco',
    description: 'Todas las formas de atún usadas en la partida atacan a la vez y se reparten sus mejoras.',
    attack: 'Todas las formas',
    icon: 'w_miracle',
    base: s({ cooldown: 1, knockback: 20 }),
    levels: [],
    evolvedFrom: 'tuna1',
  },
];

export const WEAPON_BY_ID = new Map([...WEAPONS, ...TUNA_FORMS.slice(1), ...TUNA_EXTRAS, ...EVOLUTIONS.map((e) => e.def)].map((w) => [w.id, w]));

/** Comportamiento (clave de `FIRE` en sim/weapons.ts) de un arma: el de su base si es una evolución. */
export const behaviourOf = (id: string) => WEAPON_BY_ID.get(id)?.evolvedFrom ?? id;

/** Nivel máximo de un arma; las evoluciones conservan el de su base (no tienen niveles propios). */
export function maxLevelOf(id: string): number {
  const def = WEAPON_BY_ID.get(id);
  if (!def) return 1;
  return def.evolvedFrom ? maxLevelOf(def.evolvedFrom) : def.levels.length + 1;
}

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
  whip: 'steel',
  spark: 'arcane',
  lance: 'steel',
  axe: 'steel',
  boomerang: 'steel',
  orbs: 'arcane',
  firewand: 'fire',
  ember: 'poison',
  cloud: 'arcane',
  ricochet: 'arcane',
  storm: 'lightning',
  pentagram: 'arcane',
  mana: 'arcane',
  clock: 'lightning',
  vento: 'steel',
  victory: 'steel',
  misspell: 'fire',
  phaser: 'lightning',
  unearthly: 'poison',
  ammo: 'steel',
  tuna1: 'arcane',
  tuna2: 'arcane',
  tuna3: 'arcane',
  tuna4: 'arcane',
  tuna5: 'arcane',
  tuna6: 'steel',
};

/** ¿Es un arma de fuego (o la evolución de una)? Cuenta para el Heredero del destino. */
export const isFireWeapon = (id: string) => FAMILY[behaviourOf(id)] === 'fire';

/** Impacto animado de un arma (o de su evolución): `fx_<familia>_hit`. */
export function hitFxOf(id: string): string | undefined {
  const family = FAMILY[behaviourOf(id)];
  return family && `fx_${family}_hit`;
}
