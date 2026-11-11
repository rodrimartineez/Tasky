import { PASSIVE_BY_ID, PASSIVES } from '../content/passives';
import { WEAPON_BY_ID, WEAPONS } from '../content/weapons';
import { rand } from './core';
import { levelGold } from './difficulty';
import { MAX_PASSIVES, MAX_WEAPONS, type UpgradeChoice, type WeaponDef, type WeaponState, type WeaponStats, type World } from './types';

/** Subidas de nivel, cofres y cálculo de estadísticas. */

const MAX_WEAPON_LEVEL = 8;
const MIN_COOLDOWN = 0.15;

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

function weaponChoice(def: WeaponDef, level: number): UpgradeChoice {
  return {
    kind: 'weapon',
    id: def.id,
    name: def.name,
    icon: def.icon,
    level,
    text: level === 1 ? def.description : def.levels[level - 2].text,
  };
}

/** Todo lo que el jugador puede recibir ahora, con su peso (lo que ya tiene sale más a menudo). */
function pool(w: World): { choice: UpgradeChoice; weight: number }[] {
  const p = w.player;
  const out: { choice: UpgradeChoice; weight: number }[] = [];
  for (const def of WEAPONS) {
    const owned = p.weapons.find((x) => x.id === def.id);
    if (owned) {
      if (owned.level < MAX_WEAPON_LEVEL) out.push({ choice: weaponChoice(def, owned.level + 1), weight: 3 });
    } else if (p.weapons.length < MAX_WEAPONS) {
      out.push({ choice: weaponChoice(def, 1), weight: 2 });
    }
  }
  for (const def of PASSIVES) {
    const owned = p.passives.find((x) => x.id === def.id);
    const level = (owned?.level ?? 0) + 1;
    if (level > def.maxLevel || (!owned && p.passives.length >= MAX_PASSIVES)) continue;
    out.push({ choice: { kind: 'passive', id: def.id, name: def.name, icon: def.icon, level, text: def.text }, weight: owned ? 3 : 2 });
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
  } else {
    const owned = p.passives.find((x) => x.id === choice.id);
    if (owned) owned.level = choice.level;
    else p.passives.push({ id: choice.id, level: 1 });
    recomputeStats(w);
  }
}

/** Cofre: mejora al azar 1 objeto que ya tengas (3 o 5 con suerte) y da oro. */
export function openChest(w: World) {
  const luck = w.player.stats.luck;
  const roll = rand(w);
  const count = roll < 0.03 * luck ? 5 : roll < 0.15 * luck ? 3 : 1;
  const rewards: UpgradeChoice[] = [];
  for (let i = 0; i < count; i++) {
    // Solo mejoras de lo que ya se tiene: un cofre nunca ocupa un hueco nuevo.
    const options = pool(w).filter((o) => o.choice.level > 1);
    const choice = options.length > 0 ? pickWeighted(w, options) : FALLBACKS[0];
    applyChoice(w, choice);
    rewards.push(choice);
  }
  w.gold += (20 + Math.floor(w.time / 30)) * levelGold(w.config.level);
  w.chestRewards = rewards;
}
