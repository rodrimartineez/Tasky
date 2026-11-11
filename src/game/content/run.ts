import { BASE_STATS, type RunConfig } from '../sim/types';
import { CHARACTER_BY_ID, CHARACTERS } from './characters';
import { STAGE_BY_ID, STAGES } from './stages';
import { withUpgrades } from './upgrades';

/**
 * Configuración de una partida a partir de lo que decide el resto de la app: nivel, personaje,
 * escenario y niveles de las mejoras permanentes. La semilla sale del nivel, así una partida
 * reanudada o repetida en otro dispositivo es la misma.
 *
 * `boost`: ayuda temporal solo para esta partida (fracciones: 0,3 = +30 %), p. ej. la ayuda de vuelta.
 */
export function buildRunConfig(
  level: number,
  characterId: string,
  stageId: string,
  upgrades: Record<string, number>,
  boost: { xp: number; hp: number } = { xp: 0, hp: 0 },
): RunConfig {
  const character = CHARACTER_BY_ID.get(characterId) ?? CHARACTERS[0];
  const stage = STAGE_BY_ID.get(stageId) ?? STAGES[0];
  const stats = withUpgrades(BASE_STATS, upgrades);
  character.apply(stats);
  stats.growth *= 1 + boost.xp;
  stats.maxHp *= 1 + boost.hp;
  return { seed: (Math.imul(level, 2654435761) ^ 0x5bd1e995) | 0, level, stage, stats, startingWeapon: character.weapon, sprite: character.sprite };
}
