import { describe, expect, it } from 'vitest';
import { ENEMY_BY_ID } from '../content/enemies';
import { EVOLUTIONS, type EvolutionDef } from '../content/evolutions';
import { PASSIVE_BY_ID, PASSIVES } from '../content/passives';
import { WITHERED_WOODS } from '../content/stages';
import { UPGRADE_BY_ID, withUpgrades } from '../content/upgrades';
import { maxLevelOf, TUNA_FORMS, WEAPON_BY_ID, WEAPONS } from '../content/weapons';
import { SPRITES } from '../sprites/data';
import { botPlay, firstPick } from './bot';
import { spawnEnemy } from './core';
import { levelHp } from './difficulty';
import { BASE_STATS, MAX_WEAPONS, type Stats, type World } from './types';
import {
  applyChoice,
  banishChoice,
  buildComplete,
  CHEST,
  evolutionReady,
  newWeapon,
  openChest,
  OVERLEVEL,
  recomputeStats,
  rerollChoices,
  rollChoices,
  statsAt,
  WEAPON_LEVEL_CAP,
} from './upgrades';
import { chooseUpgrade, createWorld, migrateWorld, purgeItems, skipUpgrade, step, UPGRADE_GRACE } from './world';

const config = (weapon = 'spark', stats: Stats = BASE_STATS, seed = 1) => ({
  seed,
  level: 1,
  stage: WITHERED_WOODS,
  stats,
  startingWeapon: weapon,
  sprite: 'hero',
});

const tough = { ...BASE_STATS, maxHp: 1e6 };
const passive = (w: World, id: string, level = 1) => {
  applyChoice(w, { kind: 'passive', id, name: '', icon: '', level: 1, text: '' });
  w.player.passives.find((x) => x.id === id)!.level = level;
  recomputeStats(w);
};

function put(w: World, id: string, level = maxLevelOf(id)) {
  const ws = newWeapon(id);
  ws.level = level;
  ws.stats = statsAt(WEAPON_BY_ID.get(id)!, level);
  w.player.weapons.push(ws);
  return ws;
}

const passiveMax = (id: string) => PASSIVE_BY_ID.get(id)!.maxLevel;

/**
 * Partida con el arma base de una evolución en el hueco 1 (al nivel indicado) y todo lo que pide su receta salvo
 * `skip`: la otra arma de la fusión al máximo y las pasivas (al máximo si la receta lo pide).
 */
function recipeWorld(evo: EvolutionDef, skip?: string, level = maxLevelOf(evo.weapon), passiveLevel?: number): World {
  const w = createWorld(config(evo.weapon === 'spark' ? 'lance' : 'spark'));
  put(w, evo.weapon, level);
  if (evo.union && evo.union !== skip) put(w, evo.union);
  for (const id of evo.passives) if (id !== skip) passive(w, id, passiveLevel ?? (evo.maxed ? passiveMax(id) : 1));
  return w;
}

/** Pone la partida en una subida de nivel con opciones. */
function levelUp(w: World) {
  w.pendingLevels = 1;
  w.choices = rollChoices(w);
  w.phase = 'levelup';
}

const slime = () => ENEMY_BY_ID.get('slime')!;
function dummy(w: World, x: number, y: number) {
  const e = spawnEnemy(w, slime(), x, y);
  e.hp = e.maxHp = 1e6;
  e.speed = 0;
  return e;
}

describe('catálogo cerrado', () => {
  it('solo las armas, evoluciones y pasivas de la lista, cada arma con una única evolución', () => {
    const bases = ['whip', 'spark', 'lance', 'axe', 'boomerang', 'orbs', 'firewand', 'ember', 'cloud', 'ricochet', 'storm', 'pentagram', 'mana', 'clock', 'laurel', 'vento', 'victory', 'misspell', 'phaser', 'unearthly', 'ammo', 'chain', 'quake', 'vortex', 'tuna1'];
    expect(WEAPONS.map((x) => x.id)).toEqual(bases);
    expect(TUNA_FORMS.map((x) => x.id)).toEqual(['tuna1', 'tuna2', 'tuna3', 'tuna4', 'tuna5', 'tuna6']);
    expect(EVOLUTIONS).toHaveLength(24);
    expect(PASSIVES).toHaveLength(19);
    for (const weapon of WEAPONS.filter((x) => x.id !== 'tuna1'))
      expect(
        EVOLUTIONS.filter((e) => e.weapon === weapon.id || e.union === weapon.id),
        weapon.name,
      ).toHaveLength(1);
  });

  it('cada pasiva sirve para al menos una evolución y las recetas son las de la referencia', () => {
    for (const p of PASSIVES) expect(EVOLUTIONS.some((e) => e.passives.includes(p.id)), p.name).toBe(true);
    const recipe = (id: string) => {
      const e = EVOLUTIONS.find((x) => x.def.id === id)!;
      return [e.weapon, ...(e.union ? [e.union] : []), ...e.passives, ...(e.maxed ? ['max'] : [])];
    };
    expect(recipe('galewhip')).toEqual(['whip', 'oakheart']);
    expect(recipe('constellation')).toEqual(['spark', 'hourglass']);
    expect(recipe('dawnlance')).toEqual(['lance', 'feather']);
    expect(recipe('deathspiral')).toEqual(['axe', 'lens']);
    expect(recipe('scythe')).toEqual(['boomerang', 'clover']);
    expect(recipe('eclipse')).toEqual(['orbs', 'candle']);
    expect(recipe('hellfire')).toEqual(['firewand', 'whetstone']);
    expect(recipe('pyre')).toEqual(['ember', 'herb']);
    expect(recipe('plague')).toEqual(['cloud', 'lodestone']);
    expect(recipe('luckyblades')).toEqual(['ricochet', 'scales']);
    expect(recipe('tempest')).toEqual(['storm', 'horn']);
    expect(recipe('fullmoon')).toEqual(['pentagram', 'tome']);
    expect(recipe('cataract')).toEqual(['mana', 'skull']);
    expect(recipe('eternal')).toEqual(['clock', 'silverring', 'goldring', 'max']);
    expect(recipe('thornmail')).toEqual(['laurel', 'medalleft', 'medalright', 'max']);
    expect(recipe('galedance')).toEqual(['vento', 'galewhip']);
    expect(recipe('sole')).toEqual(['victory', 'puzzlebox', 'max']);
    expect(recipe('muspell')).toEqual(['misspell', 'puzzlebox', 'max']);
    expect(recipe('photonstorm')).toEqual(['phaser', 'hourglass', 'max']);
    expect(recipe('spirit')).toEqual(['unearthly', 'tiramisu', 'max']);
    expect(recipe('gunastrophe')).toEqual(['ammo', 'feather', 'max']);
    // Armas propias de Tasky (27/11/2026), con pasivas que ya existían.
    expect(recipe('judgement')).toEqual(['chain', 'clover']);
    expect(recipe('sunquake')).toEqual(['quake', 'scales']);
    expect(recipe('eventhorizon')).toEqual(['vortex', 'lodestone']);
    for (const e of EVOLUTIONS) {
      expect(WEAPONS.some((x) => x.id === e.def.id), e.def.name).toBe(false);
      expect(WEAPON_BY_ID.get(e.def.id)).toBe(e.def);
      expect(e.def.evolvedFrom).toBe(e.weapon);
      expect(e.def.levels).toHaveLength(0);
    }
  });

  it('las armas, formas, evoluciones y pasivas tienen todos sus sprites', () => {
    const names = [
      ...EVOLUTIONS.flatMap((e) => [e.def.icon, e.def.proj ?? e.def.icon]),
      ...[...WEAPONS, ...TUNA_FORMS].map((w) => w.icon),
      ...PASSIVES.map((p) => p.icon),
      ...['axe', 'fireball', 'mana', 'vento', 'victory', 'finisher', 'flare', 'ashflame', 'dragon', 'bullet', 'gun', 'tuna', 'bigtuna', 'goldtuna', 'tornado', 'bubble', 'flask'].map((n) => `x_${n}`),
      ...['w_penshin', 'w_miracle', 'u_reroll', 'u_banish'],
    ];
    for (const name of names) expect(SPRITES[name], name).toBeDefined();
  });
});

describe('evoluciones', () => {
  for (const evo of EVOLUTIONS) {
    const base = WEAPON_BY_ID.get(evo.weapon)!;
    const missing = [...(evo.union ? [evo.union] : []), ...evo.passives];
    it(`${base.name} → ${evo.def.name}, solo con nivel máximo y toda su receta`, () => {
      // Sin cualquiera de sus ingredientes, sin el nivel máximo o (si la receta lo pide) sin las pasivas al máximo, no evoluciona.
      const incomplete = [...missing.map((id) => recipeWorld(evo, id)), recipeWorld(evo, undefined, maxLevelOf(evo.weapon) - 1)];
      if (evo.maxed) incomplete.push(recipeWorld(evo, undefined, undefined, 1));
      for (const w of incomplete) {
        expect(evolutionReady(w, w.player.weapons[1])).toBeNull();
        openChest(w);
        expect(w.player.weapons.map((x) => x.id)).not.toContain(evo.def.id);
        expect(w.chestRewards.every((r) => r.kind !== 'evolution')).toBe(true);
      }
      // Con todo, el siguiente cofre la sustituye en el mismo hueco; una fusión libera el hueco de la otra arma.
      const w = recipeWorld(evo);
      w.player.weapons[1].dealt = 123;
      expect(evolutionReady(w, w.player.weapons[1])).toBe(evo);
      openChest(w);
      const ids = w.player.weapons.map((x) => x.id);
      expect(w.chestRewards[0]).toMatchObject({ kind: 'evolution', id: evo.def.id, name: evo.def.name });
      expect(w.player.weapons[1].id).toBe(evo.def.id);
      expect(w.player.weapons[1].dealt).toBe(123);
      expect(ids).not.toContain(evo.weapon);
      if (evo.union) expect(ids).not.toContain(evo.union);
      expect(w.player.weapons).toHaveLength(2);
      expect(w.player.weapons[1].stats).toEqual(statsAt(evo.def, 1));
    });
  }

  it('las evoluciones no se ofrecen al subir de nivel, y sus armas base tampoco vuelven a salir', () => {
    const evolvedIds = new Set(EVOLUTIONS.map((e) => e.def.id));
    for (const evo of EVOLUTIONS) {
      const w = recipeWorld(evo);
      openChest(w);
      for (let i = 0; i < 40; i++) {
        w.player.passives.splice(1);
        const ids = rollChoices(w).map((c) => c.id);
        expect(ids.some((id) => evolvedIds.has(id)), evo.def.name).toBe(false);
        expect(ids, evo.def.name).not.toContain(evo.weapon);
        if (evo.union) expect(ids, evo.def.name).not.toContain(evo.union);
      }
      expect(w.player.weapons.length).toBeLessThan(MAX_WEAPONS);
    }
  });

  it('avisa en la opción que completa una evolución', () => {
    const many = (w: World) => Array.from({ length: 300 }, () => rollChoices(w)).flat();
    const wand = EVOLUTIONS.find((e) => e.weapon === 'spark')!;
    const choices = many(recipeWorld(wand, undefined, 7));
    expect(choices.find((c) => c.id === 'spark')).toMatchObject({ level: 8, evolves: wand.def.name });
    expect(choices.filter((c) => c.id !== 'spark').every((c) => !c.evolves)).toBe(true);
    // Pasiva nueva que completa la receta.
    expect(many(recipeWorld(wand, 'hourglass')).find((c) => c.id === 'hourglass')).toMatchObject({ level: 1, evolves: wand.def.name });
    // Receta que pide la pasiva al máximo: solo avisa el nivel que la completa.
    const photon = EVOLUTIONS.find((e) => e.def.id === 'photonstorm')!;
    expect(many(recipeWorld(photon, undefined, undefined, 3)).find((c) => c.id === 'hourglass')?.evolves).toBeUndefined();
    expect(many(recipeWorld(photon, undefined, undefined, 4)).find((c) => c.id === 'hourglass')).toMatchObject({ level: 5, evolves: photon.def.name });
    // Fusión: Viento Sacro al máximo con el Látigo de Sangre.
    const gale = EVOLUTIONS.find((e) => e.def.id === 'galedance')!;
    expect(many(recipeWorld(gale, undefined, 7)).find((c) => c.id === 'vento')).toMatchObject({ level: 8, evolves: gale.def.name });
  });
});

describe('Atún Cambiante', () => {
  function evolveTuna(w: World, pick: string) {
    w.player.weapons[0].level = maxLevelOf(w.player.weapons[0].id);
    openChest(w);
    step(w, 1 / 60, 0, 0);
    expect(w.phase).toBe('levelup');
    const index = w.choices.findIndex((c) => c.id === pick);
    expect(index, pick).toBeGreaterThanOrEqual(0);
    chooseUpgrade(w, index);
  }

  it('evoluciona sin pasiva, desbloquea las formas en orden y hereda sus mejoras de nivel', () => {
    const w = createWorld(config('tuna1', tough));
    expect(evolutionReady(w, w.player.weapons[0])).toBeNull();
    w.player.weapons[0].level = 6;
    expect(evolutionReady(w, w.player.weapons[0])).not.toBeNull();
    openChest(w);
    step(w, 1 / 60, 0, 0);
    // Solo la primera forma y la siguiente; no se puede repetir ni descartar en esta pantalla.
    expect(w.choices.map((c) => c.id)).toEqual(['tuna1', 'tuna2']);
    expect(rerollChoices(w)).toBe(false);
    chooseUpgrade(w, 1);
    const ws = w.player.weapons[0];
    expect(ws).toMatchObject({ id: 'tuna2', level: 1, evos: 1 });
    // Atún Exprés al máximo: +60 de velocidad, +16 de daño y un atún más, que pasan a la nueva forma.
    expect(ws.stats.speed).toBeCloseTo(WEAPON_BY_ID.get('tuna2')!.base.speed + 60);
    expect(ws.stats.damage).toBe(WEAPON_BY_ID.get('tuna2')!.base.damage + 16);
    expect(ws.stats.amount).toBe(2);
    // Las formas se desbloquean de una en una; desde la sexta evolución, también el Milagro.
    for (const id of ['tuna3', 'tuna4', 'tuna5', 'tuna6']) evolveTuna(w, id);
    evolveTuna(w, 'tuna1');
    expect(w.player.weapons[0].evos).toBe(6);
    evolveTuna(w, 'miracle');
    expect(w.player.weapons[0]).toMatchObject({ id: 'miracle', forms: ['tuna1', 'tuna2', 'tuna3', 'tuna4', 'tuna5', 'tuna6'] });
  });

  it('cada forma ataca a su manera y el Milagro las usa todas a la vez', () => {
    const kinds: Record<string, string> = { tuna1: 'bolt', tuna2: 'critter', tuna3: 'leap', tuna4: 'meteor', tuna5: 'meteor', tuna6: 'lance' };
    for (const [id, kind] of Object.entries(kinds)) {
      const w = createWorld(config(id, tough));
      dummy(w, 40, 0);
      for (let i = 0; i < 60; i++) step(w, 1 / 60, 0, 0);
      expect(w.projectiles.some((p) => p.kind === kind) || w.player.weapons[0].dealt > 0, id).toBe(true);
    }
    const w = createWorld(config('tuna1', tough));
    Object.assign(w.player.weapons[0], { evos: 6, forms: ['tuna2', 'tuna6'] });
    w.pendingForms = [0];
    step(w, 1 / 60, 0, 0);
    chooseUpgrade(w, w.choices.findIndex((c) => c.id === 'miracle'));
    dummy(w, 30, 0);
    for (let i = 0; i < 120; i++) step(w, 1 / 60, 0, 0);
    expect(w.projectiles.some((p) => p.kind === 'critter')).toBe(true);
    expect(w.projectiles.some((p) => p.sprite === 'x_goldtuna')).toBe(true);
  });

  it('solo se ofrece una vez (en cualquier forma)', () => {
    const w = createWorld(config('tuna3'));
    for (let i = 0; i < 100; i++) expect(rollChoices(w).map((c) => c.id)).not.toContain('tuna1');
  });
});

describe('mecánicas propias de las armas', () => {
  const run = (w: World, seconds: number, mx = 0, my = 0) => {
    for (let i = 0; i < seconds * 60 && w.phase === 'playing'; i++) step(w, 1 / 60, mx, my);
  };

  it('el Látigo azota en horizontal: no toca lo que está justo encima', () => {
    const w = createWorld(config('whip', tough));
    const side = dummy(w, 25, 0);
    const above = dummy(w, 0, -40);
    run(w, 1.2);
    expect(side.hp).toBeLessThan(side.maxHp);
    expect(above.hp).toBe(above.maxHp);
  });

  it('la Runa Trazadora rebota en los bordes y no sale de la pantalla', () => {
    const w = createWorld(config('ricochet', tough));
    run(w, 2);
    const runes = w.projectiles.filter((p) => p.kind === 'bounce');
    expect(runes.length).toBeGreaterThan(0);
    for (const p of runes) expect(Math.abs(p.x - w.player.x)).toBeLessThan(260);
  });

  it('la Lanceta congela sin hacer daño y el Corredor parte la vida a la mitad en cada vuelta', () => {
    const w = createWorld(config('clock', tough));
    const e = dummy(w, 0, -40); // las doce
    w.player.weapons[0].step = 11;
    w.player.weapons[0].timer = 0;
    step(w, 1 / 60, 0, 0);
    expect(e.freeze).toBeGreaterThan(0);
    expect(e.hp).toBe(e.maxHp);
    const v = createWorld(config('spark', tough));
    const corridor = put(v, 'eternal');
    corridor.step = 11;
    corridor.timer = 0;
    const far = dummy(v, 100, 50);
    step(v, 1 / 60, 0, 0);
    expect(far.hp).toBeCloseTo(far.maxHp / 2, -2);
  });

  it('el Laurel absorbe golpes enteros con sus cargas y el Sudario limita el daño y devuelve el golpe', () => {
    const w = createWorld(config('laurel'));
    w.player.weapons[0].timer = 0;
    step(w, 1 / 60, 0, 0);
    expect(w.player.shield).toBe(1);
    const hp = w.player.hp;
    hurt(w, 30);
    expect(w.player.hp).toBe(hp);
    expect(w.player.shield).toBe(0);

    const v = createWorld(config('spark'));
    put(v, 'thornmail');
    const e = dummy(v, 25, 0);
    v.player.shield = 0;
    const before = v.player.hp;
    hurt(v, 50);
    expect(before - v.player.hp).toBe(10);
    v.player.shield = 1;
    v.player.hurtTimer = 0;
    hurt(v, 50);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('la Espada de la Victoria contraataca al recibir un golpe', () => {
    const w = createWorld(config('victory'));
    w.player.weapons[0].timer = 99;
    const e = dummy(w, 20, 0);
    hurt(w, 5);
    step(w, 1 / 60, 0, 0);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('la Partitura de Maná ralentiza para siempre (hasta un 20 %)', () => {
    const w = createWorld(config('spark', tough));
    put(w, 'cataract').timer = 0;
    const e = dummy(w, 5, 0);
    run(w, 30);
    expect(e.sap).toBeLessThan(1);
    expect(e.sap).toBeGreaterThanOrEqual(0.2);
  });

  it('la Munición guarda las balas sin enemigos y el Fasor dispara cuatro haces por proyectil', () => {
    const w = createWorld(config('ammo', tough));
    run(w, 3);
    expect(w.player.weapons[0].step).toBeGreaterThan(0);
    const v = createWorld(config('phaser', tough));
    dummy(v, 60, 0);
    v.player.weapons[0].timer = 0;
    run(v, 0.5);
    expect(v.player.weapons[0].step).toBe(4);
  });

  it('la Solución Única vuelve intocable al jugador mientras dura', () => {
    const w = createWorld(config('spark', tough));
    put(w, 'sole').timer = 0;
    step(w, 1 / 60, 0, 0);
    expect(w.player.hurtTimer).toBeGreaterThan(9);
    expect(w.projectiles.some((p) => p.kind === 'galaxy')).toBe(true);
  });

  it('el Viento Sacro ataca más a menudo mientras se camina', () => {
    const count = (moving: boolean) => {
      const w = createWorld(config('vento', tough));
      for (let i = 0; i < 600; i++) step(w, 1 / 60, moving ? 1 : 0, 0);
      return w.player.weapons[0].step ?? 0;
    };
    expect(count(true)).toBeGreaterThan(count(false) * 1.5);
  });
});

/** Golpe directo al jugador (como el contacto de un enemigo). */
function hurt(w: World, amount: number, reset = true) {
  if (reset) w.player.hurtTimer = 0;
  // hurtPlayer vive en core; se usa a través de un disparo enemigo que toca al jugador.
  w.projectiles.push({ kind: 'enemyShot', sprite: 'x_thorn', weapon: -1, x: w.player.x, y: w.player.y, vx: 0, vy: 0, damage: amount, radius: 3, life: 1, pierce: 1, knockback: 0, angle: 0, orbitR: 0, sx: 0, sy: 0, tx: 0, ty: 0, total: 1, hit: [], dead: false });
  step(w, 1 / 600, 0, 0);
}

describe('pasivas, inmunidad y partidas guardadas', () => {
  it('el Tiramisú da resurrecciones que no vuelven al coger otra pasiva', () => {
    const w = createWorld(config('spark'));
    passive(w, 'tiramisu');
    expect(w.player.stats.revival).toBe(1);
    w.player.hp = 0;
    step(w, 1 / 60, 0, 0);
    expect(w.phase).toBe('playing');
    expect(w.player.hp).toBe(w.player.stats.maxHp / 2);
    expect(w.player.stats.revival).toBe(0);
    passive(w, 'whetstone');
    expect(w.player.stats.revival).toBe(0);
    // El segundo nivel da otra.
    passive(w, 'tiramisu', 2);
    expect(w.player.stats.revival).toBe(1);
  });

  it('el Tiramisú pausa la acción al revivir, da 1 s de inmunidad y se agota con la segunda resurrección', () => {
    const w = createWorld(config('spark'));
    passive(w, 'tiramisu');
    passive(w, 'tiramisu', 2);
    expect(w.player.stats.revival).toBe(2);
    w.player.hp = 0;
    step(w, 1 / 60, 0, 0);
    expect(w.reviveFreeze).toBeGreaterThan(0);
    expect(w.player.hurtTimer).toBe(1);
    const t = w.time;
    step(w, 1 / 60, 0, 0);
    expect(w.time).toBe(t); // pausa: la simulación no avanza
    expect(w.player.passives.some((x) => x.id === 'tiramisu')).toBe(true);
    w.reviveFreeze = 0;
    w.player.hp = 0;
    step(w, 1 / 60, 0, 0);
    expect(w.phase).toBe('playing');
    expect(w.player.passives.some((x) => x.id === 'tiramisu')).toBe(false);
    expect(w.player.stats.revival).toBe(0);
    expect(w.player.spentPassives).toEqual(['tiramisu']);
  });

  it('cada elección de mejora da 1 s de inmunidad, también con varias subidas seguidas', () => {
    const w = createWorld(config('spark'));
    w.pendingLevels = 2;
    step(w, 1 / 60, 0, 0);
    expect(w.phase).toBe('levelup');
    chooseUpgrade(w, 0);
    expect(w.player.hurtTimer).toBe(UPGRADE_GRACE);
    expect(w.phase).toBe('levelup');
    chooseUpgrade(w, 0);
    expect(w.phase).toBe('playing');
    expect(w.player.hurtTimer).toBe(UPGRADE_GRACE);
    // Durante ese segundo, un golpe no hace daño.
    const hp = w.player.hp;
    hurt(w, 20, false);
    expect(w.player.hp).toBe(hp);
  });

  it('una partida guardada con armas y pasivas retiradas se reanuda con sus sustitutas', () => {
    const w = createWorld(config('spark'));
    const old = JSON.parse(JSON.stringify(w)) as World;
    old.player.weapons.push({ ...newWeapon('spark'), id: 'flask', level: 7 }, { ...newWeapon('spark'), id: 'meteors', level: 3 });
    old.player.passives = [
      { id: 'boots', level: 7 },
      { id: 'whetstone', level: 7 },
    ];
    migrateWorld(old);
    expect(old.player.weapons.map((x) => [x.id, x.level])).toEqual([
      ['spark', 1],
      ['firewand', 7],
    ]);
    expect(old.player.passives).toEqual([{ id: 'whetstone', level: 5 }]);
    expect(old.player.stats.might).toBeCloseTo(1.5);
    for (let i = 0; i < 120; i++) step(old, 1 / 60, 0, 0);
  });
});

describe('Repetir y Descartar (C1)', () => {
  const withTools = (rerolls: number, banishes: number) => createWorld(config('spark', { ...BASE_STATS, rerolls, banishes }));

  it('las mejoras permanentes suben las estadísticas y cuestan lo previsto', () => {
    const stats = withUpgrades(BASE_STATS, { rerolls: 2, banishes: 3 });
    expect(stats).toMatchObject({ rerolls: 2, banishes: 3 });
    expect(BASE_STATS).toMatchObject({ rerolls: 0, banishes: 0 });
    expect([1, 2, 3].map(UPGRADE_BY_ID.get('rerolls')!.cost)).toEqual([37_500, 112_500, 337_500]);
    expect([1, 2, 3].map(UPGRADE_BY_ID.get('banishes')!.cost)).toEqual([50_000, 150_000, 450_000]);
  });

  it('se copian de las estadísticas al empezar y las partidas guardadas sin esos campos no fallan', () => {
    const w = withTools(2, 1);
    expect(w.player).toMatchObject({ rerolls: 2, banishes: 1, banished: [] });
    const old = JSON.parse(JSON.stringify(w)) as World;
    delete (old.player as Partial<World['player']>).rerolls;
    delete (old.player as Partial<World['player']>).banishes;
    delete (old.player as Partial<World['player']>).banished;
    levelUp(old);
    expect(() => rollChoices(old)).not.toThrow();
    expect(rerollChoices(old)).toBe(false);
    expect(banishChoice(old, 0)).toBe(false);
  });

  it('repetir gasta una repetición, cambia las opciones y es determinista', () => {
    const a = withTools(2, 0);
    const b = withTools(2, 0);
    levelUp(a);
    levelUp(b);
    expect(rerollChoices(a)).toBe(true);
    expect(rerollChoices(b)).toBe(true);
    expect(a.player.rerolls).toBe(1);
    expect(a.choices).toEqual(b.choices);
    expect(rerollChoices(a)).toBe(true);
    expect(a.player.rerolls).toBe(0);
    const before = a.choices;
    expect(rerollChoices(a)).toBe(false);
    expect(a.choices).toBe(before);
  });

  it('solo se puede repetir durante una subida de nivel', () => {
    const w = withTools(1, 1);
    expect(rerollChoices(w)).toBe(false);
    expect(banishChoice(w, 0)).toBe(false);
    expect(w.player).toMatchObject({ rerolls: 1, banishes: 1 });
  });

  it('descartar gasta un descarte, quita la opción para siempre y es determinista', () => {
    const a = withTools(0, 2);
    const b = withTools(0, 2);
    levelUp(a);
    levelUp(b);
    const target = a.choices[0];
    expect(banishChoice(a, 0)).toBe(true);
    expect(banishChoice(b, 0)).toBe(true);
    expect(a.player).toMatchObject({ banishes: 1, banished: [target.id] });
    expect(a.choices).toEqual(b.choices);
    for (let i = 0; i < 100; i++) expect(rollChoices(a).map((c) => c.id)).not.toContain(target.id);
    a.choices = [{ kind: 'gold', id: 'gold', name: '', icon: '', level: 1, text: '' }];
    expect(banishChoice(a, 0)).toBe(false);
    expect(banishChoice(a, 5)).toBe(false);
    expect(a.player.banishes).toBe(1);
  });

  it('una partida con repeticiones guardada y reanudada sigue igual', () => {
    const w = withTools(2, 1);
    levelUp(w);
    const copy = JSON.parse(JSON.stringify(w)) as World;
    rerollChoices(w);
    rerollChoices(copy);
    expect(copy.choices).toEqual(w.choices);
  });
});

/** Armas de apoyo sin daño propio (escudo y congelación): fuera de las comparaciones de daño. */
const UTILITY = ['laurel', 'clock'];

/** Dureza de los enemigos en la medida de daño de las armas (la que daba el nivel 20 000 antes de la Fase 8). */
const SWARM_HARDNESS = 52.74;

describe('equilibrio de builds (daño)', () => {
  /**
   * Daño causado en 90 s por un arma sola, con un personaje casi inmortal que se mueve en círculo, a partir del minuto 10
   * y con enemigos ~50 veces más resistentes: así nadie limpia la pantalla y el daño mide la potencia real del arma.
   */
  function swarmDamage(id: string): number {
    const w = createWorld({ ...config(id, tough, 21), level: 1, difficultyScale: SWARM_HARDNESS / levelHp(1) });
    const def = WEAPON_BY_ID.get(id)!;
    const ws = w.player.weapons[0];
    ws.level = maxLevelOf(id);
    ws.stats = statsAt(def, ws.level);
    w.time = 300;
    w.nextEvent = WITHERED_WOODS.events.length;
    while (w.time < 390 && w.phase !== 'dead') {
      if (w.phase === 'levelup') {
        w.pendingLevels = 0;
        w.pendingForms = [];
        w.phase = 'playing';
        continue;
      }
      step(w, 1 / 60, Math.cos(w.time * 0.5), Math.sin(w.time * 0.5));
    }
    return w.player.weapons.reduce((s, x) => s + x.dealt, 0);
  }

  it('cada evolución mejora claramente a su arma base al máximo sin pasar de 3 veces la mejor base', () => {
    const base = new Map(WEAPONS.filter((x) => !UTILITY.includes(x.id)).map((x) => [x.id, swarmDamage(x.id)]));
    const best = Math.max(...base.values());
    const wrong: string[] = [];
    for (const evo of EVOLUTIONS) {
      if (UTILITY.includes(evo.weapon)) continue;
      const evolved = swarmDamage(evo.def.id);
      const ratio = evolved / base.get(evo.weapon)!;
      if (ratio < 1.3 || evolved > best * 3) wrong.push(`${evo.def.name} (${evo.weapon}): ×${ratio.toFixed(2)}, ${(evolved / best).toFixed(2)} de la mejor`);
    }
    expect(wrong).toEqual([]);
  }, 480_000);

  it('en una partida de 5 minutos con el bot, todas las evoluciones hacen daño sin pasar de 3 veces la mejor base', () => {
    const dealt = (id: string) => {
      const w = createWorld(config(id, tough, 21));
      const def = WEAPON_BY_ID.get(id)!;
      w.player.weapons[0].level = maxLevelOf(id);
      w.player.weapons[0].stats = statsAt(def, maxLevelOf(id));
      botPlay(w, 300, undefined, firstPick);
      return w.player.weapons.find((x) => x.id === id)?.dealt ?? 0;
    };
    const best = Math.max(...WEAPONS.filter((x) => !UTILITY.includes(x.id)).map((x) => dealt(x.id)));
    for (const evo of EVOLUTIONS) {
      if (UTILITY.includes(evo.weapon)) continue;
      const d = dealt(evo.def.id);
      expect(d, evo.def.name).toBeGreaterThan(0);
      expect(d, evo.def.name).toBeLessThanOrEqual(best * 3);
    }
  }, 480_000);
});

describe('niveles de armas y pasivas (máximo propio + hasta 999)', () => {
  const offered = (w: World, id: string) => {
    levelUp(w);
    for (let i = 0; i < 40; i++) if (rollChoices(w).some((c) => c.id === id)) return true;
    return false;
  };
  const atMax = (id: string) => {
    const ws = newWeapon(id);
    ws.level = maxLevelOf(id);
    ws.stats = statsAt(WEAPON_BY_ID.get(id)!, ws.level);
    return ws;
  };

  it('un arma al máximo solo sigue subiendo con las 6 armas y las 6 pasivas al máximo; las pasivas no lo pasan', () => {
    const w = createWorld(config('spark'));
    w.purgeAt = undefined;
    w.player.weapons = [atMax('spark')];
    w.player.passives = [{ id: 'whetstone', level: 5 }];
    expect(buildComplete(w)).toBe(false);
    expect(offered(w, 'spark')).toBe(false);
    w.player.weapons = ['spark', 'lance', 'orbs', 'ember', 'storm', 'whip'].map(atMax);
    w.player.passives = ['whetstone', 'hourglass', 'lens', 'oakheart', 'tiramisu', 'clover'].map((id) => ({ id, level: passiveMax(id) }));
    w.player.passives[4].level = 1;
    expect(buildComplete(w)).toBe(false);
    expect(offered(w, 'spark')).toBe(false);
    w.player.passives[4].level = 2;
    expect(buildComplete(w)).toBe(true);
    expect(offered(w, 'spark')).toBe(true);
    expect(offered(w, 'whetstone')).toBe(false);
  });

  it('un cofre da de 1 a 5 mejoras y oro aleatorio dentro del rango de cada cofre', () => {
    const counts = [0, 0, 0, 0, 0];
    let gold = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const w = createWorld(config('spark', BASE_STATS, seed));
      w.time = 300;
      w.player.passives = ['whetstone', 'hourglass'].map((id) => ({ id, level: 1 }));
      const before = w.gold;
      openChest(w);
      counts[w.chestRewards.length - 1] += 1;
      expect(w.gold - before).toBe(w.chestGold);
      const range = CHEST.gold[w.chestRewards.length - 1];
      expect(w.chestGold).toBeGreaterThanOrEqual(range.min);
      expect(w.chestGold).toBeLessThanOrEqual(range.max);
      gold += w.chestGold ?? 0;
    }
    expect(counts.every((n) => n > 0)).toBe(true);
    expect(gold / 600).toBeGreaterThan(200);
    expect(gold / 600).toBeLessThan(3000);
  });

  it('el cofre de un jefe da más oro que uno de 5 mejoras', () => {
    expect(CHEST.boss.min).toBeGreaterThan(CHEST.gold[4].max);
    const w = createWorld(config('spark', BASE_STATS, 1));
    w.time = 300;
    openChest(w, true);
    const normal = createWorld(config('spark', BASE_STATS, 1));
    normal.time = 300;
    normal.player.stats.luck = 1000; // 5 mejoras seguras
    openChest(normal);
    expect(normal.chestRewards.length).toBe(5);
    expect(w.chestGold!).toBeGreaterThan(normal.chestGold!);
  });

  it('saltar una subida de nivel no da mejora y consume el nivel pendiente', () => {
    const w = createWorld(config('spark', BASE_STATS, 1));
    w.phase = 'levelup';
    w.pendingLevels = 1;
    w.choices = rollChoices(w);
    const weapons = w.player.weapons.map((x) => x.level);
    skipUpgrade(w);
    expect(w.phase).toBe('playing');
    expect(w.pendingLevels).toBe(0);
    expect(w.player.weapons.map((x) => x.level)).toEqual(weapons);
  });

  it('por encima del máximo cada nivel mejora el arma en porcentaje y el tope es el 999', () => {
    const def = WEAPON_BY_ID.get('spark')!;
    const max = maxLevelOf('spark');
    expect(max).toBe(8);
    const top = statsAt(def, max);
    expect(statsAt(def, max + 1).damage).toBeGreaterThan(top.damage);
    expect(statsAt(def, max + 100).damage).toBeCloseTo(top.damage * (1 + 100 * OVERLEVEL.damage), 5);
    expect(statsAt(def, max + 100).amount).toBe(top.amount + OVERLEVEL.amountMax);
    // Cada hito (cada 5 niveles) da un proyectil más, y el tamaño crece de forma visible (×2 como mucho).
    expect(statsAt(def, max + OVERLEVEL.milestone).amount).toBe(top.amount + 1);
    expect(statsAt(def, max + 10).area).toBeGreaterThan(top.area * 1.15);
    expect(statsAt(def, max + 200).area).toBeCloseTo(top.area * OVERLEVEL.areaMax, 5);
    expect(statsAt(def, 5000)).toEqual(statsAt(def, WEAPON_LEVEL_CAP));
    expect(statsAt(def, WEAPON_LEVEL_CAP).cooldown).toBeGreaterThan(0.1);
  });
});

describe('purga', () => {
  it('sale en ~1 de cada 5 partidas y se ofrece una sola vez', () => {
    const runs = Array.from({ length: 2000 }, (_, seed) => createWorld(config('spark', BASE_STATS, seed + 1)));
    const share = runs.filter((w) => w.purgeAt !== undefined).length / runs.length;
    expect(share).toBeGreaterThan(0.16);
    expect(share).toBeLessThan(0.24);
  });

  it('quita las armas y pasivas elegidas, deja sus huecos libres y no protege de quedarse sin armas', () => {
    const w = createWorld(config('spark'));
    w.player.weapons.push(newWeapon('lance'));
    w.player.passives = [{ id: 'oakheart', level: 5 }];
    recomputeStats(w);
    w.purgeAt = 1;
    levelUp(w);
    const index = w.choices.findIndex((c) => c.kind === 'purge');
    expect(index).toBeGreaterThanOrEqual(0);
    chooseUpgrade(w, index);
    expect(w.phase).toBe('purge');
    expect(w.purgeAt).toBeUndefined();
    purgeItems(w, [0, 1], [0]);
    expect(w.player.weapons).toHaveLength(0);
    expect(w.player.passives).toHaveLength(0);
    expect(w.player.stats.maxHp).toBe(BASE_STATS.maxHp);
    expect(w.phase).toBe('playing');
    expect(w.player.hurtTimer).toBe(UPGRADE_GRACE);
  });
});
