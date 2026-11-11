import { EVOLUTION_BY_WEAPON, type EvolutionDef } from '../content/evolutions';
import { PASSIVE_BY_ID, PASSIVES } from '../content/passives';
import { WEAPON_BY_ID, WEAPONS, weaponStatsAt } from '../content/weapons';
import { emit, rand } from './core';
import { runGold } from './difficulty';
import { MAX_PASSIVES, MAX_WEAPONS, type UpgradeChoice, type WeaponDef, type WeaponState, type World } from './types';

/** Subidas de nivel, evoluciones, cofres y cálculo de estadísticas. */

export { weaponStatsAt };
const MAX_WEAPON_LEVEL = 8;

export function newWeapon(id: string): WeaponState {
  const def = WEAPON_BY_ID.get(id);
  if (!def) throw new Error(`Arma desconocida: ${id}`);
  return { id, level: 1, stats: weaponStatsAt(def, 1), timer: 0.5, dealt: 0 };
}

/** Recalcula las estadísticas del jugador: las iniciales de la partida más las pasivas. */
export function recomputeStats(w: World) {
  const p = w.player;
  const before = p.stats.maxHp;
  const stats = { ...w.config.stats };
  for (const owned of p.passives) PASSIVE_BY_ID.get(owned.id)?.apply(stats, owned.level);
  p.stats = stats;
  // La vida máxima ganada se suma también a la vida actual.
  if (stats.maxHp > before) p.hp += stats.maxHp - before;
  p.hp = Math.min(p.hp, stats.maxHp);
}

/** Evolución que el arma tiene lista: nivel máximo, con la pasiva necesaria y sin haber evolucionado ya. */
export function evolutionReady(w: World, ws: WeaponState): EvolutionDef | null {
  const evo = EVOLUTION_BY_WEAPON.get(ws.id);
  if (!evo || ws.level < MAX_WEAPON_LEVEL) return null;
  return w.player.passives.some((x) => x.id === evo.passive) ? evo : null;
}

/** Evoluciona el arma en su mismo hueco (conserva el daño acumulado para el resumen) y devuelve lo que se muestra. */
function evolve(w: World, ws: WeaponState, evo: EvolutionDef): UpgradeChoice {
  const p = w.player;
  const next = newWeapon(evo.def.id);
  next.level = MAX_WEAPON_LEVEL;
  next.dealt = ws.dealt;
  next.timer = ws.timer;
  p.weapons[p.weapons.indexOf(ws)] = next;
  emit(w, { type: 'ring', x: p.x, y: p.y, radius: 90, color: 0xffe08a });
  emit(w, { type: 'ring', x: p.x, y: p.y, radius: 55, color: 0xffffff });
  emit(w, { type: 'shake', power: 3 });
  return {
    kind: 'evolution',
    id: evo.def.id,
    name: evo.def.name,
    icon: evo.def.icon,
    level: MAX_WEAPON_LEVEL,
    text: `${WEAPON_BY_ID.get(ws.id)?.name ?? ws.id} → ${evo.def.name}`,
  };
}

function weaponChoice(w: World, def: WeaponDef, level: number): UpgradeChoice {
  const evo = EVOLUTION_BY_WEAPON.get(def.id);
  const completes = level === MAX_WEAPON_LEVEL && evo && w.player.passives.some((x) => x.id === evo.passive);
  return {
    kind: 'weapon',
    id: def.id,
    name: def.name,
    icon: def.icon,
    level,
    text: level === 1 ? def.description : def.levels[level - 2].text,
    ...(completes ? { evolves: evo.def.name } : {}),
  };
}

/** Todo lo que el jugador puede recibir ahora, con su peso (lo que ya tiene sale más a menudo). */
function pool(w: World): { choice: UpgradeChoice; weight: number }[] {
  const p = w.player;
  const out: { choice: UpgradeChoice; weight: number }[] = [];
  const banished = p.banished ?? [];
  for (const def of WEAPONS) {
    if (banished.includes(def.id)) continue;
    const owned = p.weapons.find((x) => x.id === def.id);
    if (owned) {
      if (owned.level < MAX_WEAPON_LEVEL) out.push({ choice: weaponChoice(w, def, owned.level + 1), weight: 3 });
    } else if (p.weapons.length < MAX_WEAPONS) {
      // Una evolución ocupa el lugar de su arma base, que no vuelve a ofrecerse como nueva.
      const evolvedId = EVOLUTION_BY_WEAPON.get(def.id)?.def.id;
      if (!p.weapons.some((x) => x.id === evolvedId)) out.push({ choice: weaponChoice(w, def, 1), weight: 2 });
    }
  }
  for (const def of PASSIVES) {
    if (banished.includes(def.id)) continue;
    const owned = p.passives.find((x) => x.id === def.id);
    const level = (owned?.level ?? 0) + 1;
    if (level > def.maxLevel || (!owned && p.passives.length >= MAX_PASSIVES)) continue;
    // Una pasiva nueva que completa la evolución de un arma que ya está al máximo se avisa en la opción.
    const completes = owned
      ? undefined
      : p.weapons
          .map((ws) => EVOLUTION_BY_WEAPON.get(ws.id))
          .find((evo) => evo?.passive === def.id && p.weapons.some((ws) => ws.id === evo.weapon && ws.level >= MAX_WEAPON_LEVEL));
    out.push({
      choice: {
        kind: 'passive',
        id: def.id,
        name: def.name,
        icon: def.icon,
        level,
        text: def.text,
        ...(completes ? { evolves: completes.def.name } : {}),
      },
      weight: owned ? 3 : 2,
    });
  }
  return out;
}

function pickWeighted(w: World, options: { choice: UpgradeChoice; weight: number }[]): UpgradeChoice {
  let roll = rand(w) * options.reduce((s, o) => s + o.weight, 0);
  for (let i = 0; i < options.length; i++) {
    roll -= options[i].weight;
    if (roll <= 0) return options.splice(i, 1)[0].choice;
  }
  return options.pop()!.choice;
}

const FALLBACKS: UpgradeChoice[] = [
  { kind: 'gold', id: 'gold', name: 'Bolsa de oro', icon: 'i_coin', level: 1, text: '+30 de oro' },
  { kind: 'heal', id: 'heal', name: 'Poción', icon: 'i_heart', level: 1, text: 'Recupera 40 de vida' },
];

/** Opciones de una subida de nivel: 3, o 4 con suerte. Con todo al máximo, oro o curación. */
export function rollChoices(w: World): UpgradeChoice[] {
  const options = pool(w);
  if (options.length === 0) return FALLBACKS;
  const count = rand(w) < Math.min(0.5, 0.1 * w.player.stats.luck) ? 4 : 3;
  const choices: UpgradeChoice[] = [];
  while (choices.length < count && options.length > 0) choices.push(pickWeighted(w, options));
  return choices;
}

/** Repite las opciones de la subida de nivel (gasta una repetición). Devuelve si se pudo. */
export function rerollChoices(w: World): boolean {
  const p = w.player;
  if (w.phase !== 'levelup' || (p.rerolls ?? 0) <= 0) return false;
  p.rerolls -= 1;
  w.choices = rollChoices(w);
  return true;
}

/** Descarta una opción para el resto de la partida (gasta un descarte) y vuelve a sacar opciones. */
export function banishChoice(w: World, index: number): boolean {
  const p = w.player;
  const choice = w.choices[index];
  if (w.phase !== 'levelup' || (p.banishes ?? 0) <= 0 || !choice || (choice.kind !== 'weapon' && choice.kind !== 'passive')) return false;
  (p.banished ??= []).push(choice.id);
  p.banishes -= 1;
  w.choices = rollChoices(w);
  return true;
}

export function applyChoice(w: World, choice: UpgradeChoice) {
  const p = w.player;
  if (choice.kind === 'gold') w.gold += 30;
  else if (choice.kind === 'heal') p.hp = Math.min(p.stats.maxHp, p.hp + 40);
  else if (choice.kind === 'weapon') {
    const owned = p.weapons.find((x) => x.id === choice.id);
    if (!owned) p.weapons.push(newWeapon(choice.id));
    else {
      owned.level = choice.level;
      owned.stats = weaponStatsAt(WEAPON_BY_ID.get(owned.id)!, owned.level);
    }
  } else if (choice.kind === 'passive') {
    const owned = p.passives.find((x) => x.id === choice.id);
    if (owned) owned.level = choice.level;
    else p.passives.push({ id: choice.id, level: 1 });
    recomputeStats(w);
  }
}

/** Cofre: evoluciona las armas que lo tengan listo y, si no, mejora al azar 1 objeto que ya tengas (3 o 5 con suerte); da oro. */
export function openChest(w: World) {
  const luck = w.player.stats.luck;
  const roll = rand(w);
  const count = roll < 0.03 * luck ? 5 : roll < 0.15 * luck ? 3 : 1;
  const rewards: UpgradeChoice[] = [];
  for (let i = 0; i < count; i++) {
    const ready = w.player.weapons.filter((ws) => evolutionReady(w, ws));
    if (ready.length > 0) {
      const ws = ready[Math.floor(rand(w) * ready.length)];
      rewards.push(evolve(w, ws, evolutionReady(w, ws)!));
      continue;
    }
    // Solo mejoras de lo que ya se tiene: un cofre nunca ocupa un hueco nuevo.
    const options = pool(w).filter((o) => o.choice.level > 1);
    const choice = options.length > 0 ? pickWeighted(w, options) : FALLBACKS[0];
    applyChoice(w, choice);
    rewards.push(choice);
  }
  w.gold += (20 + Math.floor(w.time / 30)) * runGold(w.config);
  w.chestRewards = rewards;
}
