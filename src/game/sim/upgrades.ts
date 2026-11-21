import { EVOLUTION_BY_WEAPON, EVOLUTIONS, type EvolutionDef } from '../content/evolutions';
import { PASSIVE_BY_ID, PASSIVES } from '../content/passives';
import { maxLevelOf, TUNA_IDS, WEAPON_BY_ID, WEAPONS, weaponStatsAt } from '../content/weapons';
import { emit, rand } from './core';
import { runGold } from './difficulty';
import { MAX_PASSIVES, MAX_WEAPONS, TIMELINE, type UpgradeChoice, type WeaponDef, type WeaponState, type WeaponStats, type World } from './types';

/** Subidas de nivel, evoluciones, cofres y cálculo de estadísticas. */

export { maxLevelOf, weaponStatsAt };

/**
 * Niveles: cada arma tiene los suyos (`maxLevelOf`, casi siempre 8) y cada pasiva su `maxLevel`. Al máximo dejan de
 * mejorar hasta que todo lo que se lleva (armas y pasivas) está al máximo; entonces las armas siguen subiendo con
 * mejoras porcentuales hasta el 999. Las pasivas no pasan de su máximo.
 */
export const WEAPON_LEVEL_CAP = 999;

/** Mejora porcentual de cada nivel por encima del máximo. Proyectiles y perforación extra cada cierto número de niveles. */
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

/** Estadísticas de un arma en cualquier nivel (1–999), con las mejoras heredadas (`carry`, Atún Cambiante). */
export function statsAt(def: WeaponDef, level: number, carry?: Partial<WeaponStats>) {
  const max = maxLevelOf(def.id);
  const stats = weaponStatsAt(def, Math.min(level, max));
  for (const key in carry) stats[key as keyof WeaponStats] += carry[key as keyof WeaponStats] ?? 0;
  const extra = Math.max(0, Math.min(level, WEAPON_LEVEL_CAP) - max);
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

/** Huecos de arma ocupados (los regalos de una evolución no ocupan hueco). */
export const slotsUsed = (w: World) => w.player.weapons.length;

/**
 * Build completa: las seis armas y las seis pasivas, todas al máximo. Solo entonces las armas siguen subiendo
 * (hasta el 999); las pasivas nunca pasan de su máximo.
 */
export const buildComplete = (w: World) =>
  slotsUsed(w) >= MAX_WEAPONS &&
  w.player.passives.length >= MAX_PASSIVES &&
  w.player.weapons.every((x) => x.level >= maxLevelOf(x.id)) &&
  w.player.passives.every((x) => x.level >= (PASSIVE_BY_ID.get(x.id)?.maxLevel ?? 1));

function overlevelText(id: string, level: number): string {
  const extra = level - maxLevelOf(id);
  const parts = [`+${Math.round(OVERLEVEL.damage * 100)} % de daño`];
  if (extra % OVERLEVEL.amountEvery === 0 && extra / OVERLEVEL.amountEvery <= OVERLEVEL.amountMax) parts.push('un proyectil más');
  if (extra % OVERLEVEL.pierceEvery === 0) parts.push('atraviesa uno más');
  return `${parts.join(', ')} y algo más de área, cadencia y alcance`;
}

export function newWeapon(id: string): WeaponState {
  const def = WEAPON_BY_ID.get(id);
  if (!def) throw new Error(`Arma desconocida: ${id}`);
  // Las armas de recarga muy larga (Pentáculo) no se gastan nada más cogerlas, con la pantalla vacía.
  const level = def.evolvedFrom ? maxLevelOf(def.evolvedFrom) : 1;
  return { id, level, stats: statsAt(def, level), timer: def.base.cooldown >= 20 ? 5 : 0.5, dealt: 0 };
}

/** Recalcula las estadísticas del jugador: las iniciales de la partida más las pasivas. */
export function recomputeStats(w: World) {
  const p = w.player;
  const before = p.stats.maxHp;
  const stats = { ...w.config.stats };
  for (const owned of p.passives) PASSIVE_BY_ID.get(owned.id)?.apply(stats, owned.level);
  // Las resurrecciones gastadas no vuelven al recalcular (p. ej. al coger otra pasiva); con La Muerte, ninguna.
  stats.revival = w.completed ? 0 : Math.max(0, stats.revival - (p.revivalsUsed ?? 0));
  p.stats = stats;
  // La vida máxima ganada se suma también a la vida actual.
  if (stats.maxHp > before) p.hp += stats.maxHp - before;
  p.hp = Math.min(p.hp, stats.maxHp);
}

/** Nivel de una pasiva que se lleva (0 si no). */
export const passiveLevel = (w: World, id: string) => w.player.passives.find((x) => x.id === id)?.level ?? 0;
const maxedWeapon = (w: World, id: string) => w.player.weapons.some((x) => x.id === id && x.level >= maxLevelOf(id));

/**
 * Receta completa suponiendo, si se indica, que se lleva un arma o pasiva a cierto nivel (`assume`): sirve para avisar
 * en la opción de nivel que la completaría.
 */
function recipeMet(w: World, evo: EvolutionDef, assume?: { id: string; level: number }): boolean {
  const level = (id: string) => (assume?.id === id ? assume.level : passiveLevel(w, id));
  return (
    [evo.weapon, ...(evo.union ? [evo.union] : [])].every((id) => (assume?.id === id && assume.level >= maxLevelOf(id)) || maxedWeapon(w, id)) &&
    evo.passives.every((id) => level(id) >= (evo.maxed ? (PASSIVE_BY_ID.get(id)?.maxLevel ?? 1) : 1))
  );
}

const isTuna = (id: string) => TUNA_IDS.includes(id);

/** Evolución del Atún Cambiante: sin pasiva, al máximo de su forma; luego se elige la forma nueva. */
const TUNA_EVOLUTION = { def: { id: 'penshin', name: 'Atún Cambiante', icon: 'w_penshin' } };
type Evolution = EvolutionDef | typeof TUNA_EVOLUTION;

/**
 * Evolución que el arma tiene lista: nivel máximo y todo lo que pide su receta, sin haber evolucionado ya (un regalo
 * solo se da una vez). Las formas del Atún Cambiante, sin receta.
 */
export function evolutionReady(w: World, ws: WeaponState): Evolution | null {
  if (ws.level < maxLevelOf(ws.id)) return null;
  if (isTuna(ws.id)) return (w.pendingForms ?? []).includes(w.player.weapons.indexOf(ws)) ? null : TUNA_EVOLUTION;
  const evo = EVOLUTION_BY_WEAPON.get(ws.id);
  if (!evo) return null;
  return recipeMet(w, evo) ? evo : null;
}

/** Suma de las mejoras de nivel que lleva un arma, incluidas las heredadas (las hereda la siguiente forma del atún). */
function levelMods(ws: WeaponState): Partial<WeaponStats> {
  const out: Partial<WeaponStats> = { ...ws.carry };
  for (const lvl of WEAPON_BY_ID.get(ws.id)!.levels.slice(0, ws.level - 1))
    for (const key in lvl.mods) {
      const k = key as keyof WeaponStats;
      out[k] = (out[k] ?? 0) + (lvl.mods[k] ?? 0);
    }
  return out;
}

/**
 * Evoluciona el arma en su mismo hueco (conserva el daño acumulado para el resumen) y devuelve lo que se muestra.
 * En una fusión, la otra arma desaparece y deja libre su hueco. El atún deja
 * pendiente la elección de forma (sim/world.ts la muestra como una pantalla de mejora).
 */
function evolve(w: World, ws: WeaponState, evo: Evolution): UpgradeChoice {
  const p = w.player;
  emit(w, { type: 'ring', x: p.x, y: p.y, radius: 90, color: 0xffe08a });
  emit(w, { type: 'ring', x: p.x, y: p.y, radius: 55, color: 0xffffff });
  emit(w, { type: 'shake', power: 3 });
  if (!('weapon' in evo)) {
    ws.carry = levelMods(ws);
    ws.evos = (ws.evos ?? 0) + 1;
    ws.forms = [...new Set([...(ws.forms ?? []), ws.id])];
    (w.pendingForms ??= []).push(p.weapons.indexOf(ws));
    return { kind: 'evolution', id: evo.def.id, name: evo.def.name, icon: evo.def.icon, level: ws.level, text: 'Elige la nueva forma del atún' };
  }
  const next = newWeapon(evo.def.id);
  next.level = ws.level;
  next.stats = statsAt(evo.def, ws.level);
  next.dealt = ws.dealt;
  next.timer = ws.timer;
  p.weapons[p.weapons.indexOf(ws)] = next;
  const partner = evo.union && p.weapons.find((x) => x !== next && (x.id === evo.union || x.id === evo.weapon));
  if (partner) {
    next.dealt += partner.dealt;
    p.weapons.splice(p.weapons.indexOf(partner), 1);
  }
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
  // Subir esta arma al máximo completa la receta (en una fusión, si la otra arma ya está al máximo).
  const completes = level === maxLevelOf(def.id) && evo && recipeMet(w, evo, { id: def.id, level });
  return {
    kind: 'weapon',
    id: def.id,
    name: def.name,
    icon: def.icon,
    level,
    text: level === 1 ? def.description : level > maxLevelOf(def.id) ? overlevelText(def.id, level) : def.levels[level - 2].text,
    ...(completes ? { evolves: evo.def.name } : {}),
  };
}

/** Todo lo que el jugador puede recibir ahora, con su peso (lo que ya tiene sale más a menudo). */
function pool(w: World): { choice: UpgradeChoice; weight: number }[] {
  const p = w.player;
  const out: { choice: UpgradeChoice; weight: number }[] = [];
  const banished = p.banished ?? [];
  // Las armas evolucionadas no están en WEAPONS, pero también suben por encima del máximo.
  const complete = buildComplete(w);
  if (complete)
    for (const owned of p.weapons) {
      const def = WEAPON_BY_ID.get(owned.id);
      if (def?.evolvedFrom && owned.level < WEAPON_LEVEL_CAP) out.push({ choice: weaponChoice(w, def, owned.level + 1), weight: 2 });
    }
  for (const def of [...WEAPONS, ...p.weapons.filter((x) => isTuna(x.id) && x.id !== 'tuna1').map((x) => WEAPON_BY_ID.get(x.id)!)]) {
    if (banished.includes(def.id)) continue;
    const owned = p.weapons.find((x) => x.id === def.id);
    if (owned) {
      if (owned.level < maxLevelOf(def.id)) out.push({ choice: weaponChoice(w, def, owned.level + 1), weight: 3 });
      else if (complete && owned.level < WEAPON_LEVEL_CAP && !isTuna(def.id)) out.push({ choice: weaponChoice(w, def, owned.level + 1), weight: 2 });
    } else if (slotsUsed(w) < MAX_WEAPONS) {
      // Una evolución ocupa el lugar de su arma base (y de la otra de una fusión), que no vuelve a ofrecerse como nueva.
      const evolvedId = EVOLUTION_BY_WEAPON.get(def.id)?.def.id;
      // El atún, solo una vez (en cualquiera de sus formas).
      const tunaOwned = isTuna(def.id) && p.weapons.some((x) => isTuna(x.id) || x.id === 'miracle');
      if (!tunaOwned && !p.weapons.some((x) => x.id === evolvedId)) out.push({ choice: weaponChoice(w, def, 1), weight: 2 });
    }
  }
  for (const def of PASSIVES) {
    if (banished.includes(def.id)) continue;
    const owned = p.passives.find((x) => x.id === def.id);
    const level = (owned?.level ?? 0) + 1;
    if (level > def.maxLevel || (!owned && p.passives.length >= MAX_PASSIVES)) continue;
    // Una pasiva que completa una receta (nueva, o al máximo si la receta lo pide) se avisa en la opción.
    const completes = EVOLUTIONS.find((evo) => evo.passives.includes(def.id) && !recipeMet(w, evo) && recipeMet(w, evo, { id: def.id, level }));
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

/** La pantalla de mejora es la elección de forma del atún (sin repetir ni descartar). */
export const choosingForm = (w: World) => w.choices.some((c) => c.kind === 'form');

/** Repite las opciones de la subida de nivel (gasta una repetición). Devuelve si se pudo. */
export function rerollChoices(w: World): boolean {
  const p = w.player;
  if (w.phase !== 'levelup' || (p.rerolls ?? 0) <= 0 || choosingForm(w)) return false;
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

/**
 * Formas que se pueden elegir tras una evolución del atún: cada evolución desbloquea la siguiente (en orden, sin
 * saltarse ninguna) y las ya desbloqueadas se pueden repetir. Desde la sexta, también el Milagro.
 */
export function formChoices(w: World, index: number): UpgradeChoice[] {
  const evos = w.player.weapons[index]?.evos ?? 0;
  const ids = [...TUNA_IDS.slice(0, Math.min(TUNA_IDS.length, evos + 1)), ...(evos >= 6 ? ['miracle'] : [])];
  return ids.map((id) => {
    const def = WEAPON_BY_ID.get(id)!;
    return { kind: 'form', id, name: def.name, icon: def.icon, level: 1, text: def.description };
  });
}

/** Cambia el atún a la forma elegida: nivel 1, con las mejoras heredadas de todas las anteriores. */
export function applyForm(w: World, index: number, id: string) {
  const p = w.player;
  const old = p.weapons[index];
  if (!old) return;
  const next = newWeapon(id);
  Object.assign(next, { carry: old.carry, evos: old.evos, forms: old.forms, dealt: old.dealt });
  next.stats = statsAt(WEAPON_BY_ID.get(id)!, 1, old.carry);
  // El Milagro ya está al máximo (sube por encima solo con la build completa, como las evoluciones).
  if (id === 'miracle') {
    next.level = maxLevelOf(id);
    next.timers = (old.forms ?? []).map((_, i) => 0.3 + i * 0.2);
  }
  p.weapons[index] = next;
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
      owned.stats = statsAt(WEAPON_BY_ID.get(owned.id)!, owned.level, owned.carry);
    }
  } else if (choice.kind === 'passive') {
    const owned = p.passives.find((x) => x.id === choice.id);
    if (owned) owned.level = choice.level;
    else p.passives.push({ id: choice.id, level: 1 });
    recomputeStats(w);
  }
}

/**
 * Cofre: de 1 a 5 mejoras (más con suerte) y oro que crece con ellas: CHEST.gold[n - 1] es el multiplicador (el de 5
 * mejoras da unas 10 veces lo del de 1). El cofre de un jefe (`boss`) paga siempre más que uno de 5 mejoras.
 */
export const CHEST = { odds: [0.03, 0.05, 0.1, 0.17], gold: [0.8, 2.4, 4.4, 6, 8], boss: 12, heal: 0.1 };

/** Cofre: evoluciona las armas que lo tengan listo y, si no, mejora al azar objetos que ya tengas; da oro. */
export function openChest(w: World, boss = false) {
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
  w.player.hp = Math.min(w.player.stats.maxHp, w.player.hp + w.player.stats.maxHp * CHEST.heal);
  const gold = Math.round((20 + Math.floor((w.time * TIMELINE) / 30)) * (boss ? CHEST.boss : CHEST.gold[count - 1]) * runGold(w.config));
  w.gold += gold;
  w.chestGold = gold;
  w.chestRewards = rewards;
}
