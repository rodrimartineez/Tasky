import { EVOLUTION_BY_WEAPON, type EvolutionDef } from '../content/evolutions';
import { PASSIVE_BY_ID, PASSIVES } from '../content/passives';
import { WEAPON_BY_ID, WEAPONS, weaponStatsAt } from '../content/weapons';
import { emit, rand } from './core';
import { runGold } from './difficulty';
import { MAX_PASSIVES, MAX_WEAPONS, TIMELINE, type UpgradeChoice, type WeaponDef, type WeaponState, type World } from './types';

/** Subidas de nivel, evoluciones, cofres y cálculo de estadísticas. */

export { weaponStatsAt };

/**
 * Niveles: armas y pasivas tienen 7 niveles de contenido. Al 7 dejan de mejorar hasta que todo lo que se lleva
 * (armas y pasivas) está al 7; entonces las armas siguen subiendo con mejoras porcentuales hasta el 999. Las pasivas
 * se quedan en el 7.
 */
export const MAX_WEAPON_LEVEL = 7;
export const WEAPON_LEVEL_CAP = 999;

/** Mejora porcentual de cada nivel por encima del 7. Proyectiles y perforación extra cada cierto número de niveles. */
export const OVERLEVEL = {
  damage: 0.05,
  area: 0.004,
  areaMax: 1.6,
  haste: 0.004,
  speed: 0.003,
  duration: 0.003,
  amountEvery: 50,
  amountMax: 5,
  pierceEvery: 30,
};

/** Estadísticas de un arma en cualquier nivel (1–999). */
export function statsAt(def: WeaponDef, level: number) {
  const stats = weaponStatsAt(def, Math.min(level, MAX_WEAPON_LEVEL));
  const extra = Math.max(0, Math.min(level, WEAPON_LEVEL_CAP) - MAX_WEAPON_LEVEL);
  if (extra === 0) return stats;
  stats.damage *= 1 + OVERLEVEL.damage * extra;
  stats.area *= Math.min(OVERLEVEL.areaMax, 1 + OVERLEVEL.area * extra);
  stats.cooldown = Math.max(Math.min(stats.cooldown, 0.15), stats.cooldown / (1 + OVERLEVEL.haste * extra));
  stats.speed *= 1 + OVERLEVEL.speed * extra;
  stats.duration *= 1 + OVERLEVEL.duration * extra;
  stats.amount += Math.min(OVERLEVEL.amountMax, Math.floor(extra / OVERLEVEL.amountEvery));
  if (stats.pierce < 999) stats.pierce += Math.floor(extra / OVERLEVEL.pierceEvery);
  return stats;
}

/**
 * Build completa: las cinco armas y las cinco pasivas, todas al nivel 7. Solo entonces las armas siguen subiendo
 * (hasta el 999); las pasivas nunca pasan del 7.
 */
export const buildComplete = (w: World) =>
  w.player.weapons.length >= MAX_WEAPONS &&
  w.player.passives.length >= MAX_PASSIVES &&
  w.player.weapons.every((x) => x.level >= MAX_WEAPON_LEVEL) &&
  w.player.passives.every((x) => x.level >= (PASSIVE_BY_ID.get(x.id)?.maxLevel ?? MAX_WEAPON_LEVEL));

function overlevelText(level: number): string {
  const extra = level - MAX_WEAPON_LEVEL;
  const parts = [`+${Math.round(OVERLEVEL.damage * 100)} % de daño`];
  if (extra % OVERLEVEL.amountEvery === 0 && extra / OVERLEVEL.amountEvery <= OVERLEVEL.amountMax) parts.push('un proyectil más');
  if (extra % OVERLEVEL.pierceEvery === 0) parts.push('atraviesa uno más');
  return `${parts.join(', ')} y algo más de área, cadencia y alcance`;
}

export function newWeapon(id: string): WeaponState {
  const def = WEAPON_BY_ID.get(id);
  if (!def) throw new Error(`Arma desconocida: ${id}`);
  return { id, level: 1, stats: statsAt(def, 1), timer: 0.5, dealt: 0 };
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
  next.level = ws.level;
  next.stats = statsAt(evo.def, ws.level);
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
    level: ws.level,
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
    text: level === 1 ? def.description : level > MAX_WEAPON_LEVEL ? overlevelText(level) : def.levels[level - 2].text,
    ...(completes ? { evolves: evo.def.name } : {}),
  };
}

/** Todo lo que el jugador puede recibir ahora, con su peso (lo que ya tiene sale más a menudo). */
function pool(w: World): { choice: UpgradeChoice; weight: number }[] {
  const p = w.player;
  const out: { choice: UpgradeChoice; weight: number }[] = [];
  const banished = p.banished ?? [];
  // Las armas evolucionadas no están en WEAPONS, pero también suben por encima del 7.
  const complete = buildComplete(w);
  if (complete)
    for (const owned of p.weapons) {
      const def = WEAPON_BY_ID.get(owned.id);
      if (def?.evolvedFrom && owned.level < WEAPON_LEVEL_CAP) out.push({ choice: weaponChoice(w, def, owned.level + 1), weight: 2 });
    }
  for (const def of WEAPONS) {
    if (banished.includes(def.id)) continue;
    const owned = p.weapons.find((x) => x.id === def.id);
    if (owned) {
      if (owned.level < MAX_WEAPON_LEVEL) out.push({ choice: weaponChoice(w, def, owned.level + 1), weight: 3 });
      else if (complete && owned.level < WEAPON_LEVEL_CAP) out.push({ choice: weaponChoice(w, def, owned.level + 1), weight: 2 });
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

const PURGE_CHOICE: UpgradeChoice = {
  kind: 'purge',
  id: 'purge',
  name: 'Purga',
  icon: 'i_purge',
  level: 1,
  text: 'Elige armas y pasivas para eliminarlas y liberar sus huecos. ¡Cuidado con quedarte indefenso!',
};

const FALLBACKS: UpgradeChoice[] = [
  { kind: 'gold', id: 'gold', name: 'Bolsa de oro', icon: 'i_coin', level: 1, text: '+30 de oro' },
  { kind: 'heal', id: 'heal', name: 'Poción', icon: 'i_heart', level: 1, text: 'Recupera 40 de vida' },
];

/** Opciones de una subida de nivel: 3, o 4 con suerte. Con todo al máximo, oro o curación. */
export function rollChoices(w: World): UpgradeChoice[] {
  const options = pool(w);
  const choices: UpgradeChoice[] = [];
  if (options.length === 0) choices.push(...FALLBACKS);
  else {
    const count = rand(w) < Math.min(0.5, 0.1 * w.player.stats.luck) ? 4 : 3;
    while (choices.length < count && options.length > 0) choices.push(pickWeighted(w, options));
  }
  // Mejora especial de eliminar: sustituye a la última opción (también con el inventario lleno o todo al máximo).
  if (w.purgeAt !== undefined && w.player.level >= w.purgeAt) choices[choices.length - 1] = PURGE_CHOICE;
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
      owned.stats = statsAt(WEAPON_BY_ID.get(owned.id)!, owned.level);
    }
  } else if (choice.kind === 'passive') {
    const owned = p.passives.find((x) => x.id === choice.id);
    if (owned) owned.level = choice.level;
    else p.passives.push({ id: choice.id, level: 1 });
    recomputeStats(w);
  }
}

/**
 * Cofre: de 1 a 5 mejoras (más con suerte) y algo de oro que crece con ellas. La media de oro es la misma que cuando
 * el cofre daba siempre la misma cantidad, así que la economía no cambia: CHEST.gold[n - 1] es el multiplicador.
 */
export const CHEST = { odds: [0.03, 0.05, 0.1, 0.17], gold: [0.8, 1.1, 1.4, 1.8, 2.4] };

/** Cofre: evoluciona las armas que lo tengan listo y, si no, mejora al azar objetos que ya tengas; da oro. */
export function openChest(w: World) {
  const luck = w.player.stats.luck;
  const roll = rand(w);
  // Probabilidades acumuladas de 5, 4, 3 y 2 mejoras (escalan con la suerte); si no, 1.
  let count = 1;
  let acc = 0;
  for (let i = 0; i < CHEST.odds.length; i++) {
    acc += CHEST.odds[i] * luck;
    if (roll < acc) {
      count = 5 - i;
      break;
    }
  }
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
  const gold = Math.round((20 + Math.floor((w.time * TIMELINE) / 30)) * CHEST.gold[count - 1] * runGold(w.config));
  w.gold += gold;
  w.chestGold = gold;
  w.chestRewards = rewards;
}
