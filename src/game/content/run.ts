import { BASE_STATS, type RunConfig, type RunMode } from '../sim/types';
import { cycleBossFor } from './bosses';
import { CHARACTER_BY_ID, CHARACTERS } from './characters';
import { STAGE_BY_ID, STAGES } from './stages';
import { withUpgrades } from './upgrades';

/**
 * Configuración de una partida a partir de lo que decide el resto de la app: nivel, personaje,
 * escenario y niveles de las mejoras permanentes.
 *
 * - `seed`: la de la partida. Sale del número de intento, así cada intento del mismo nivel es distinto y una
 *   partida empezada en un dispositivo es la misma en otro.
 * - `mode`: modalidad (normal, infinita o reflejo). En los niveles de jefe (múltiplos de 7) aparece el jefe de
 *   ciclo, salvo en el modo infinito.
 * - `boost`: ayuda temporal solo para esta partida (fracciones: 0,3 = +30 %), p. ej. la ayuda de vuelta.
 */
export function buildRunConfig(
  level: number,
  characterId: string,
  stageId: string,
  upgrades: Record<string, number>,
  { boost = { xp: 0, hp: 0 }, mode = 'normal', seed = level }: { boost?: { xp: number; hp: number }; mode?: RunMode; seed?: number } = {},
): RunConfig {
  const character = CHARACTER_BY_ID.get(characterId) ?? CHARACTERS[0];
  const stage = STAGE_BY_ID.get(stageId) ?? STAGES[0];
  const stats = withUpgrades(BASE_STATS, upgrades);
  character.apply(stats);
  stats.growth *= 1 + boost.xp;
  stats.maxHp *= 1 + boost.hp;
  const cycleBoss = mode === 'infinite' ? null : cycleBossFor(level);
  return {
    seed: (Math.imul(seed, 2654435761) ^ Math.imul(level, 40503) ^ 0x5bd1e995) | 0,
    level,
    stage,
    stats,
    startingWeapon: character.weapon,
    bonusWeapons: character.bonusWeapons,
    sprite: character.sprite,
    mode,
    ...(cycleBoss ? { cycleBoss } : {}),
  };
}
