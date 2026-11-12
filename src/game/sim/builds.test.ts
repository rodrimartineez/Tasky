import { describe, expect, it } from 'vitest';
import { ENEMY_BY_ID } from '../content/enemies';
import { EVOLUTIONS } from '../content/evolutions';
import { PASSIVE_BY_ID, PASSIVES } from '../content/passives';
import { WITHERED_WOODS } from '../content/stages';
import { UPGRADE_BY_ID, withUpgrades } from '../content/upgrades';
import { WEAPON_BY_ID, WEAPONS, weaponStatsAt } from '../content/weapons';
import { SPRITES } from '../sprites/data';
import { botPlay, firstPick } from './bot';
import { spawnEnemy } from './core';
import { levelHp } from './difficulty';
import { BASE_STATS, MAX_WEAPONS, type Stats, type World } from './types';
import {
  applyChoice,
  banishChoice,
  buildComplete,
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
import { chooseUpgrade, createWorld, purgeItems, step } from './world';

const config = (weapon = 'spark', stats: Stats = BASE_STATS, seed = 1) => ({
  seed,
  level: 1,
  stage: WITHERED_WOODS,
  stats,
  startingWeapon: weapon,
  sprite: 'hero',
});

/** Partida con el arma indicada al nivel máximo (y, si se pide, con la pasiva). */
function maxed(weapon: string, passive?: string, level = 7, slot = 1): World {
  const w = createWorld(config(weapon === 'spark' ? 'lance' : 'spark'));
  const ws = newWeapon(weapon);
  ws.level = level;
  ws.stats = weaponStatsAt(WEAPON_BY_ID.get(weapon)!, level);
  w.player.weapons[slot] = ws;
  if (passive) applyChoice(w, { kind: 'passive', id: passive, name: '', icon: '', level: 1, text: '' });
  return w;
}

/** Pone la partida en una subida de nivel con opciones. */
function levelUp(w: World) {
  w.pendingLevels = 1;
  w.choices = rollChoices(w);
  w.phase = 'levelup';
}

describe('contenido de las builds', () => {
  it('16 armas y 14 pasivas, y cada arma tiene una sola evolución', () => {
    expect(WEAPONS).toHaveLength(16);
    expect(PASSIVES).toHaveLength(14);
    expect(EVOLUTIONS).toHaveLength(WEAPONS.length);
    for (const weapon of WEAPONS)
      expect(
        EVOLUTIONS.filter((e) => e.weapon === weapon.id),
        weapon.name,
      ).toHaveLength(1);
  });

  it('cada pasiva sirve para al menos una evolución y las evoluciones no están entre las armas que se ofrecen', () => {
    for (const passive of PASSIVES)
      expect(
        EVOLUTIONS.some((e) => e.passive === passive.id),
        passive.name,
      ).toBe(true);
    for (const e of EVOLUTIONS) {
      expect(PASSIVE_BY_ID.has(e.passive), e.def.name).toBe(true);
      expect(
        WEAPONS.some((x) => x.id === e.def.id),
        e.def.name,
      ).toBe(false);
      expect(WEAPON_BY_ID.get(e.def.id)).toBe(e.def);
      expect(e.def.evolvedFrom).toBe(e.weapon);
      expect(e.def.levels).toHaveLength(0);
    }
    expect(new Set(EVOLUTIONS.map((e) => e.def.id)).size).toBe(EVOLUTIONS.length);
  });

  it('las armas, evoluciones y pasivas nuevas tienen todos sus sprites', () => {
    const names = [
      ...EVOLUTIONS.flatMap((e) => [e.def.icon, e.def.proj ?? e.def.icon]),
      ...['ricochet', 'drone', 'trail'].map((id) => WEAPON_BY_ID.get(id)!.icon),
      ...['eye', 'fang'].map((id) => PASSIVE_BY_ID.get(id)!.icon),
      'x_dronebolt',
      'x_gunshipbolt',
      'u_reroll',
      'u_banish',
    ];
    for (const name of names) expect(SPRITES[name], name).toBeDefined();
  });
});

describe('evoluciones (B1)', () => {
  for (const evo of EVOLUTIONS) {
    const base = WEAPON_BY_ID.get(evo.weapon)!;
    it(`${base.name} + ${PASSIVE_BY_ID.get(evo.passive)!.name} → ${evo.def.name}, solo con nivel máximo y la pasiva`, () => {
      // Sin la pasiva o sin el nivel máximo, el cofre no evoluciona.
      for (const w of [maxed(evo.weapon), maxed(evo.weapon, evo.passive, 6)]) {
        expect(evolutionReady(w, w.player.weapons[1])).toBeNull();
        openChest(w);
        expect(w.player.weapons.map((x) => x.id)).toContain(evo.weapon);
        expect(w.player.weapons.map((x) => x.id)).not.toContain(evo.def.id);
        expect(w.chestRewards.every((r) => r.kind !== 'evolution')).toBe(true);
      }
      // Con las dos cosas, el siguiente cofre la sustituye en el mismo hueco.
      const w = maxed(evo.weapon, evo.passive);
      const dealt = 123;
      w.player.weapons[1].dealt = dealt;
      expect(evolutionReady(w, w.player.weapons[1])).toBe(evo);
      openChest(w);
      expect(w.player.weapons[1].id).toBe(evo.def.id);
      expect(w.player.weapons[1].dealt).toBe(dealt);
      expect(w.player.weapons.map((x) => x.id)).not.toContain(evo.weapon);
      expect(w.player.weapons).toHaveLength(2);
      expect(w.chestRewards[0]).toMatchObject({ kind: 'evolution', id: evo.def.id, name: evo.def.name });
      expect(w.player.weapons[1].stats).toEqual(evo.def.base);
    });
  }

  it('las evoluciones no se ofrecen al subir de nivel, y su arma base tampoco vuelve a salir', () => {
    const evolvedIds = new Set(EVOLUTIONS.map((e) => e.def.id));
    for (const evo of EVOLUTIONS) {
      const w = maxed(evo.weapon, evo.passive);
      openChest(w);
      for (let i = 0; i < 40; i++) {
        w.player.passives.length = 1; // siempre hay hueco para opciones nuevas
        const ids = rollChoices(w).map((c) => c.id);
        expect(
          ids.some((id) => evolvedIds.has(id)),
          evo.def.name,
        ).toBe(false);
        expect(ids, evo.def.name).not.toContain(evo.weapon);
      }
      expect(w.player.weapons.length).toBeLessThan(MAX_WEAPONS);
    }
  });

  it('avisa en la opción que completa una evolución', () => {
    const evo = EVOLUTIONS.find((e) => e.weapon === 'spark')!;
    // Arma al nivel 6 con la pasiva: subirla al 7 completa la evolución.
    const w = maxed('spark', evo.passive, 6, 0);
    const choices = Array.from({ length: 30 }, () => rollChoices(w)).flat();
    expect(choices.find((c) => c.id === 'spark')).toMatchObject({ level: 7, evolves: evo.def.name });
    // Arma al máximo sin la pasiva: la pasiva nueva la completa.
    const v = maxed('spark', undefined, 7, 0);
    const passive = Array.from({ length: 30 }, () => rollChoices(v))
      .flat()
      .find((c) => c.id === evo.passive);
    expect(passive).toMatchObject({ level: 1, evolves: evo.def.name });
    // Una opción que no completa nada no lleva el aviso.
    expect(choices.filter((c) => c.id !== 'spark' && c.id !== evo.passive).every((c) => !c.evolves)).toBe(true);
  });
});

describe('Repetir y Descartar (C1)', () => {
  const withTools = (rerolls: number, banishes: number) => createWorld(config('spark', { ...BASE_STATS, rerolls, banishes }));

  it('las mejoras permanentes suben las estadísticas y cuestan lo previsto', () => {
    const stats = withUpgrades(BASE_STATS, { rerolls: 2, banishes: 3 });
    expect(stats).toMatchObject({ rerolls: 2, banishes: 3 });
    expect(BASE_STATS).toMatchObject({ rerolls: 0, banishes: 0 });
    expect([1, 2, 3].map(UPGRADE_BY_ID.get('rerolls')!.cost)).toEqual([150, 450, 1350]);
    expect([1, 2, 3].map(UPGRADE_BY_ID.get('banishes')!.cost)).toEqual([200, 600, 1800]);
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
    // Sin repeticiones no hace nada.
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
    // Ni al subir de nivel ni en los cofres vuelve a salir.
    for (let i = 0; i < 100; i++) {
      expect(rollChoices(a).map((c) => c.id)).not.toContain(target.id);
    }
    // Un objeto que no es arma ni pasiva no se descarta.
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

describe('armas y pasivas nuevas (B2)', () => {
  const play = (weapon: string, seconds: number, stats: Stats = { ...BASE_STATS, maxHp: 1e6 }) => {
    const w = createWorld(config(weapon, stats, 5));
    botPlay(w, seconds);
    return w;
  };

  for (const id of ['ricochet', 'drone', 'trail']) {
    it(`${WEAPON_BY_ID.get(id)!.name} causa daño`, () => {
      const w = play(id, 120);
      expect(w.player.weapons.find((x) => x.id === id)!.dealt).toBeGreaterThan(0);
      expect(w.kills).toBeGreaterThan(0);
    });
  }

  it('las cuchillas rebotan: una sola golpea a varios enemigos alineados', () => {
    const w = createWorld(config('ricochet', { ...BASE_STATS, maxHp: 1e6 }));
    const slime = ENEMY_BY_ID.get('slime')!;
    // Tres enemigos separados; una cuchilla con 3 rebotes puede tocarlos a todos.
    const enemies = [spawnEnemy(w, slime, 50, 0), spawnEnemy(w, slime, 80, 40), spawnEnemy(w, slime, 120, -30)];
    for (const e of enemies) e.hp = e.maxHp = 1e5;
    w.player.weapons[0].timer = 0;
    for (let i = 0; i < 90; i++) step(w, 1 / 60, 0, 0);
    expect(enemies.filter((e) => e.hp < e.maxHp).length).toBeGreaterThanOrEqual(3);
  });

  it('el dron dispara a distancia sin tocar al enemigo', () => {
    const w = createWorld(config('drone', { ...BASE_STATS, maxHp: 1e6 }));
    const e = spawnEnemy(w, ENEMY_BY_ID.get('slime')!, 100, 0);
    e.hp = e.maxHp = 1e5;
    e.speed = 0;
    w.player.weapons[0].timer = 0;
    for (let i = 0; i < 240; i++) step(w, 1 / 60, 0, 0);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(w.projectiles.some((p) => p.kind === 'drone')).toBe(true);
  });

  it('la estela deja llamas en el suelo mientras te mueves, sin apilarlas', () => {
    const w = createWorld(config('trail', { ...BASE_STATS, maxHp: 1e6 }));
    for (let i = 0; i < 120; i++) step(w, 1 / 60, 1, 0);
    const flames = w.projectiles.filter((p) => p.kind === 'flame');
    expect(flames.length).toBeGreaterThan(3);
    const parado = createWorld(config('trail', { ...BASE_STATS, maxHp: 1e6 }));
    for (let i = 0; i < 120; i++) step(parado, 1 / 60, 0, 0);
    expect(parado.projectiles.filter((p) => p.kind === 'flame').length).toBeLessThanOrEqual(1);
  });

  it('Ojo de águila sube el crítico y Colmillo de sangre cura al golpear (y tolera partidas antiguas)', () => {
    const w = createWorld(config('spark'));
    applyChoice(w, { kind: 'passive', id: 'eye', name: '', icon: '', level: 1, text: '' });
    expect(w.player.stats.critChance).toBeCloseTo(BASE_STATS.critChance + 0.04);
    expect(w.player.stats.critMult).toBeCloseTo(BASE_STATS.critMult + 0.1);

    // Una partida guardada antes del campo `leech` no tiene el valor: no debe salir NaN.
    delete (w.config.stats as Partial<Stats>).leech;
    applyChoice(w, { kind: 'passive', id: 'fang', name: '', icon: '', level: 1, text: '' });
    recomputeStats(w);
    expect(w.player.stats.leech).toBeCloseTo(0.004);
    w.player.hp = 50;
    const slime = spawnEnemy(w, ENEMY_BY_ID.get('slime')!, 20, 0);
    slime.hp = slime.maxHp = 1e6;
    w.player.weapons[0].timer = 0;
    for (let i = 0; i < 60; i++) step(w, 1 / 60, 0, 0);
    expect(w.player.hp).toBeGreaterThan(50 - 20);
    expect(Number.isFinite(w.player.hp)).toBe(true);
  });
});

/** Dureza de los enemigos en la medida de daño de las armas (la que daba el nivel 20 000 antes de la Fase 8). */
const SWARM_HARDNESS = 52.74;

describe('equilibrio de builds (daño)', () => {
  /**
   * Daño causado en 90 s por un arma sola, con un personaje casi inmortal que se mueve en círculo, a partir del minuto 10
   * y con enemigos ~50 veces más resistentes (dureza fija, independiente de la curva de niveles): así nadie limpia la pantalla y el daño mide la potencia real del arma.
   * (En una partida normal el daño total queda limitado por los enemigos que aparecen, y no distingue armas fuertes de muy fuertes.)
   */
  function swarmDamage(id: string): number {
    const w = createWorld({ ...config(id, { ...BASE_STATS, maxHp: 1e6 }, 21), level: 1, difficultyScale: SWARM_HARDNESS / levelHp(1) });
    const def = WEAPON_BY_ID.get(id)!;
    const ws = w.player.weapons[0];
    if (!def.evolvedFrom) {
      ws.level = 7;
      ws.stats = weaponStatsAt(def, 7);
    }
    w.time = 600;
    w.nextEvent = WITHERED_WOODS.events.length;
    while (w.time < 690 && w.phase !== 'dead') {
      if (w.phase === 'levelup') {
        w.pendingLevels = 0;
        w.phase = 'playing';
        continue;
      }
      step(w, 1 / 60, Math.cos(w.time * 0.5), Math.sin(w.time * 0.5));
    }
    return ws.dealt;
  }

  // Margen 1,55–2,8 (antes 1,6–2,7): desde la Fase 8 el enjambre incluye veteranos más resistentes y las armas de
  // golpes grandes (meteoritos) o muy repartidos (Constelación) se separan ~0,04 más de su base.
  it('cada evolución hace entre 1,55 y 2,8 veces el daño de su arma base al nivel máximo, y ninguna pasa de 2,5 veces la mejor base', () => {
    const base = new Map(WEAPONS.map((x) => [x.id, swarmDamage(x.id)]));
    const best = Math.max(...base.values());
    const wrong: string[] = [];
    for (const evo of EVOLUTIONS) {
      const evolved = swarmDamage(evo.def.id);
      const ratio = evolved / base.get(evo.weapon)!;
      if (ratio < 1.55 || ratio > 2.8 || evolved > best * 2.5) wrong.push(`${evo.def.name} (${evo.weapon}): ×${ratio.toFixed(2)}`);
    }
    expect(wrong).toEqual([]);
    for (const id of ['ricochet', 'drone', 'trail']) expect(base.get(id)!, id).toBeLessThanOrEqual(best * 2.5);
  }, 240_000);

  it('en una partida de 5 minutos con el bot, ninguna evolución ni arma nueva supera 2,5 veces a la mejor arma base', () => {
    // Las armas base empiezan al nivel máximo y las evoluciones ya son lo que son; el resto de mejoras las elige el bot.
    const dealt = (id: string) => {
      const w = createWorld(config(id, { ...BASE_STATS, maxHp: 1e6 }, 21));
      const def = WEAPON_BY_ID.get(id)!;
      if (!def.evolvedFrom) {
        w.player.weapons[0].level = 7;
        w.player.weapons[0].stats = weaponStatsAt(def, 7);
      }
      botPlay(w, 300, undefined, firstPick);
      return w.player.weapons.find((x) => x.id === id)?.dealt ?? 0;
    };
    const best = Math.max(...WEAPONS.map((x) => dealt(x.id)));
    for (const evo of EVOLUTIONS) {
      const d = dealt(evo.def.id);
      expect(d, evo.def.name).toBeGreaterThan(0);
      expect(d, evo.def.name).toBeLessThanOrEqual(best * 2.5);
    }
  }, 240_000);
});

describe('niveles de armas y pasivas (7 + hasta 999)', () => {
  const offered = (w: World, id: string) => {
    levelUp(w);
    for (let i = 0; i < 40; i++) {
      if (rollChoices(w).some((c) => c.id === id)) return true;
    }
    return false;
  };

  it('un arma al 7 solo sigue subiendo con las 5 armas y las 5 pasivas al 7; las pasivas nunca pasan del 7', () => {
    const w = createWorld(config('spark'));
    w.purgeAt = undefined;
    const at7 = (id: string) => {
      const ws = newWeapon(id);
      ws.level = 7;
      ws.stats = statsAt(WEAPON_BY_ID.get(id)!, 7);
      return ws;
    };
    w.player.weapons = [at7('spark')];
    w.player.passives = [{ id: 'whetstone', level: 7 }];
    // Todo lo que se lleva está al 7, pero faltan huecos por llenar.
    expect(buildComplete(w)).toBe(false);
    expect(offered(w, 'spark')).toBe(false);
    w.player.weapons = ['spark', 'lance', 'orbs', 'ember', 'storm'].map(at7);
    w.player.passives = ['whetstone', 'hourglass', 'lens', 'boots', 'clover'].map((id) => ({ id, level: 7 }));
    w.player.passives[4].level = 6;
    expect(buildComplete(w)).toBe(false);
    expect(offered(w, 'spark')).toBe(false);
    w.player.passives[4].level = 7;
    expect(buildComplete(w)).toBe(true);
    expect(offered(w, 'spark')).toBe(true);
    expect(offered(w, 'whetstone')).toBe(false);
  });

  it('un cofre da de 1 a 5 mejoras y más oro cuantas más da, con la misma media de antes', () => {
    const counts = [0, 0, 0, 0, 0];
    let gold = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const w = createWorld(config('spark', BASE_STATS, seed));
      w.time = 600;
      w.player.passives = ['whetstone', 'hourglass'].map((id) => ({ id, level: 1 }));
      const before = w.gold;
      openChest(w);
      counts[w.chestRewards.length - 1] += 1;
      expect(w.gold - before).toBe(w.chestGold);
      gold += w.chestGold ?? 0;
    }
    expect(counts.every((n) => n > 0)).toBe(true);
    // Media de antes: 20 + 600 / 30 = 40 de oro por cofre (sin bonificaciones de partida).
    expect(gold / 600).toBeGreaterThan(36);
    expect(gold / 600).toBeLessThan(46);
  });

  it('por encima del 7 cada nivel mejora el arma en porcentaje y el máximo es el 999', () => {
    const def = WEAPON_BY_ID.get('spark')!;
    const at7 = statsAt(def, 7);
    expect(statsAt(def, 8).damage).toBeGreaterThan(at7.damage);
    expect(statsAt(def, 107).damage).toBeCloseTo(at7.damage * (1 + 100 * OVERLEVEL.damage), 5);
    expect(statsAt(def, 107).amount).toBe(at7.amount + 2);
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
    w.player.passives = [{ id: 'oakheart', level: 7 }];
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
  });
});
