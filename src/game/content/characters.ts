import type { Stats } from '../sim/types';

/**
 * Personajes jugables. Se desbloquean con oro (`price`). Cada uno cambia de verdad la forma de jugar:
 * arma inicial propia y un rasgo que modifica sus estadísticas. El contenido completo (~16) llega en la Fase 5.
 */
export interface CharacterDef {
  id: string;
  name: string;
  /** Sprite base (fotogramas `<sprite>_0` y `<sprite>_1`). */
  sprite: string;
  /** Tinte del sprite mientras no tenga arte propio (0xffffff = sin tinte). */
  tint: number;
  price: number;
  weapon: string;
  /** Rasgo en una frase. */
  trait: string;
  apply(stats: Stats): void;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'wanderer',
    name: 'Errante',
    sprite: 'hero',
    tint: 0xffffff,
    price: 0,
    weapon: 'spark',
    trait: 'Equilibrado: sin puntos débiles.',
    apply: () => undefined,
  },
  {
    id: 'warden',
    name: 'Guardiana',
    sprite: 'hero',
    tint: 0x9fd8ff,
    price: 600,
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
    sprite: 'hero',
    tint: 0xffb3d9,
    price: 1500,
    weapon: 'ember',
    trait: '+20 % de área y de duración, pero −20 % de vida.',
    apply: (s) => {
      s.area *= 1.2;
      s.duration *= 1.2;
      s.maxHp *= 0.8;
    },
  },
];

export const CHARACTER_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));
