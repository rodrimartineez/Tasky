import { BASE_STATS, type RunConfig, type RunMode } from '../sim/types';
import { ARCANA_BY_ID } from './arcana';
import { cycleBossFor } from './bosses';
import { CHARACTER_BY_ID, CHARACTERS } from './characters';
import { SKIN_BY_ID } from './skins';
import { STAGE_BY_ID, STAGES } from './stages';
import { withUpgrades } from './upgrades';

/**
 * Configuración de una partida a partir de lo que decide el resto de la app: nivel, personaje,
 * escenario y niveles de las mejoras permanentes.
 *
 * - `seed`: la de la partida. Sale del número de intento, así cada intento del mismo nivel es distinto y una
 *   partida empezada en un dispositivo es la misma en otro.
 * - `mode`: modalidad (normal, infinita o reflejo). En los niveles de jefe (múltiplos de 7) aparece el jefe de
 *   ciclo en todas.
 * - `boost`: ayuda temporal solo para esta partida (fracciones: 0,3 = +30 %), p. ej. la ayuda de vuelta.
 * - `arcana`: arcano elegido (Fase 10): cambia el personaje, la dureza y el oro de esta partida.
 * - `skin`: aspecto del personaje (solo visual).
 */
export function buildRunConfig(
  level: number,
  characterId: string,
  stageId: string,
  upgrades: Record<string, number>,
  {
    boost = { xp: 0, hp: 0 },
    mode = 'normal',
    seed = level,
    arcana,
    skin,
    weapons,
  }: {
    boost?: { xp: number; hp: number };
    mode?: RunMode;
    seed?: number;
    arcana?: string | null;
    skin?: string | null;
    /** Armas iniciales elegidas (personajes con `pickStart`). */
    weapons?: string[];
  } = {},
): RunConfig {
  const character = CHARACTER_BY_ID.get(characterId) ?? CHARACTERS[0];
  const stage = STAGE_BY_ID.get(stageId) ?? STAGES[0];
  const stats = withUpgrades(BASE_STATS, upgrades);
  character.apply(stats);
  stats.growth *= 1 + boost.xp;
  stats.maxHp *= 1 + boost.hp;
  const arcanaDef = arcana ? ARCANA_BY_ID.get(arcana) : undefined;
  arcanaDef?.apply?.(stats);
  const skinDef = skin ? SKIN_BY_ID.get(skin) : undefined;
  const cycleBoss = cycleBossFor(level);
  const picked = character.pickStart && weapons?.length === character.pickStart ? weapons : undefined;
  return {
    seed: (Math.imul(seed, 2654435761) ^ Math.imul(level, 40503) ^ 0x5bd1e995) | 0,
    level,
    stage,
    stats,
    startingWeapon: picked?.[0] ?? character.weapon,
    bonusWeapons: picked ? picked.slice(1) : character.bonusWeapons,
    sprite: character.sprite,
    mode,
    ...(cycleBoss ? { cycleBoss } : {}),
    ...(arcanaDef
      ? { arcana: arcanaDef.id, goldScale: arcanaDef.gold, ...(arcanaDef.hardness ? { difficultyScale: arcanaDef.hardness } : {}) }
      : {}),
    ...(skinDef ? { skin: { tint: skinDef.tint, ...(skinDef.aura ? { aura: skinDef.aura } : {}) } } : {}),
  };
}
