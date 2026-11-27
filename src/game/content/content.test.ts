import { describe, expect, it } from 'vitest';
import { survivalBonus } from '../sim/difficulty';
import { botPlay, firstPick } from '../sim/bot';
import { BASE_STATS, MAX_PASSIVES, MAX_WEAPONS, type World } from '../sim/types';
import { createWorld } from '../sim/world';
import { SPRITES } from '../sprites/data';
import { CHARACTERS } from './characters';
import { ENEMY_BY_ID, ENEMIES } from './enemies';
import { PASSIVES } from './passives';
import { buildRunConfig } from './run';
import { STAGES } from './stages';
import { WEAPON_BY_ID, WEAPONS } from './weapons';

const finite = (w: World) =>
  [w.player.x, w.player.y, w.player.hp, w.gold, ...w.enemies.flatMap((e) => [e.x, e.y, e.hp])].every(Number.isFinite);

describe('contenido', () => {
  it('hay 16 personajes y 4 legendarios con precios crecientes, armas y sprites que existen', () => {
    expect(CHARACTERS).toHaveLength(20);
    expect(CHARACTERS.filter((c) => c.legendary)).toHaveLength(4);
    expect(CHARACTERS[0].price).toBe(0);
    const prices = CHARACTERS.map((c) => c.price);
    expect(prices.every((p, i) => i === 0 || p > prices[i - 1])).toBe(true);
    expect(prices.at(-1)).toBe(10_000_000);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(20);
    expect(new Set(CHARACTERS.map((c) => c.sprite)).size).toBe(20);
    // Cada personaje normal empieza con un arma distinta (los legendarios quedan fuera de esta regla).
    const normal = CHARACTERS.filter((c) => !c.legendary).map((c) => c.weapon);
    expect(new Set(normal).size).toBe(normal.length);
    for (const c of CHARACTERS) {
      for (const w of [c.weapon, ...(c.bonusWeapons ?? [])]) expect(WEAPON_BY_ID.has(w), `${c.name}: arma ${w}`).toBe(true);
      expect(SPRITES[`${c.sprite}_0`], `${c.name}: fotograma 0`).toBeDefined();
      expect(SPRITES[`${c.sprite}_1`], `${c.name}: fotograma 1`).toBeDefined();
    }
  });

  it('el Tormentario empieza con cuatro armas y el Eclipsado revive dos veces', () => {
    const storm = createWorld(buildRunConfig(1, 'collector', 'withered_woods', {}));
    expect(storm.player.weapons.map((w) => w.id)).toEqual(['storm', 'phaser', 'ember', 'spark']);
    const eclipse = createWorld(buildRunConfig(1, 'sun_avatar', 'withered_woods', {}, { weapons: ['pyre'] }));
    expect(eclipse.player.stats.revival).toBe(2);
  });

  it('el Cronomante elige dos armas y el Eclipsado una evolución, que empieza al nivel máximo', () => {
    const chrono = buildRunConfig(1, 'chronomancer', 'withered_woods', {}, { weapons: ['whip', 'axe'] });
    expect(createWorld(chrono).player.weapons.map((w) => w.id)).toEqual(['whip', 'axe']);
    const eclipse = createWorld(buildRunConfig(1, 'sun_avatar', 'withered_woods', {}, { weapons: ['pyre'] }));
    expect(eclipse.player.weapons.map((w) => [w.id, w.level])).toEqual([['pyre', 8]]);
  });

  it('el sprite del personaje elegido llega a la configuración de la partida', () => {
    for (const c of CHARACTERS) {
      const config = buildRunConfig(1, c.id, 'withered_woods', {});
      expect(config.sprite).toBe(c.sprite);
      expect(config.startingWeapon).toBe(c.weapon);
      expect(createWorld(config).player.weapons[0].id).toBe(c.weapon);
    }
  });

  it('hay 5 escenarios con precios crecientes, enemigos, jefes y decoración que existen', () => {
    expect(STAGES.map((s) => s.price)).toEqual([0, 4_500, 25_000, 75_000, 150_000]);
    for (const stage of STAGES) {
      for (const name of stage.props) expect(SPRITES[name], `${stage.name}: ${name}`).toBeDefined();
      for (const rule of stage.spawns) expect(ENEMY_BY_ID.has(rule.enemy), `${stage.name}: ${rule.enemy}`).toBe(true);
      const bosses = stage.events.filter((e) => e.kind === 'boss');
      expect(bosses.map((e) => e.at)).toEqual([600, 1200, 1680]);
      for (const event of stage.events) expect(ENEMY_BY_ID.has(event.enemy), `${stage.name}: ${event.enemy}`).toBe(true);
      expect(stage.events.map((e) => e.at)).toEqual([...stage.events.map((e) => e.at)].sort((a, b) => a - b));
    }
  });

  it('todos los enemigos, armas y objetos tienen sprite', () => {
    for (const e of ENEMIES) expect(SPRITES[e.sprite], e.name).toBeDefined();
    for (const w of WEAPONS) expect(SPRITES[w.icon], w.name).toBeDefined();
    for (const p of PASSIVES) expect(SPRITES[p.icon], p.name).toBeDefined();
  });

  it('hay 6 huecos de armas y de pasivas y variedad de armas y pasivas', () => {
    expect(MAX_WEAPONS).toBe(6);
    expect(MAX_PASSIVES).toBe(6);
    expect(WEAPONS.length).toBeGreaterThanOrEqual(12);
    expect(PASSIVES.length).toBeGreaterThanOrEqual(10);
  });
});

describe('escenarios', () => {
  for (const stage of STAGES) {
    it(`${stage.name}: 120 s de partida con el bot sin números inválidos`, () => {
      const stats = { ...BASE_STATS, maxHp: 1e5 };
      const w = createWorld({ seed: 5, level: 1, stage, stats, startingWeapon: 'spark', sprite: 'hero' });
      botPlay(w, 120);
      expect(w.time).toBeGreaterThanOrEqual(120);
      expect(w.kills).toBeGreaterThan(10);
      expect(finite(w)).toBe(true);
    }, 30_000);
  }

  it('los jefes de cada escenario aparecen a los 10 minutos', () => {
    for (const stage of STAGES) {
      const w = createWorld({ seed: 9, level: 1, stage, stats: { ...BASE_STATS, maxHp: 1e9 }, startingWeapon: 'spark', sprite: 'hero' });
      w.time = 600 - 1;
      botPlay(w, 3);
      expect(w.bossAlive || w.kills > 0, stage.name).toBe(true);
      expect(
        w.enemies.some((e) => e.def.ai === 'boss'),
        stage.name,
      ).toBe(true);
      expect(finite(w)).toBe(true);
    }
  }, 30_000);
});

describe('equilibrio de armas', () => {
  // Daño de cada arma como inicial en 5 min con un personaje sin mejoras y casi inmortal: ninguna debe pasar de ~2× la mejor de las originales.
  const ORIGINAL = ['spark', 'lance', 'orbs', 'ember', 'storm', 'firewand'];
  const dealt = (weapon: string) => {
    const w = createWorld({
      seed: 21,
      level: 1,
      stage: STAGES[0],
      stats: { ...BASE_STATS, maxHp: 1e6 },
      startingWeapon: weapon,
      sprite: 'hero',
    });
    botPlay(w, 300, undefined, firstPick);
    // Si llega a evolucionar en estos 5 minutos, su daño incluye el de la evolución: solo cuenta que haga daño
    // (las evoluciones tienen su propia prueba en sim/builds.test.ts).
    const ws = w.player.weapons.find((x) => x.id === weapon || WEAPON_BY_ID.get(x.id)?.evolvedFrom === weapon);
    return { dealt: ws?.dealt ?? 0, evolved: ws?.id !== weapon };
  };

  // Margen ×2,25 (antes ×2): desde que las élites tienen ×10 de vida (12/11/2026) absorben más daño de las armas de
  // área, que ya no lo desperdician, y Nova sube a ~×2,2 en este total de 5 minutos.
  it('ninguna arma nueva supera 2,25 veces la mejor original', () => {
    // El Laurel (escudo) no hace daño.
    const results = new Map(WEAPONS.filter((w) => w.base.damage > 0).map((w) => [w.id, dealt(w.id)]));
    const best = Math.max(...ORIGINAL.map((id) => results.get(id)!.dealt));
    for (const [id, { dealt: d, evolved }] of results) {
      expect(d, id).toBeGreaterThan(0);
      if (!evolved) expect(d, id).toBeLessThan(best * 2.25);
    }
  }, 120_000);
});

describe('bonificación de oro por supervivencia', () => {
  it('no existe en el nivel 1 ni antes del minuto 10, y crece con el nivel y los minutos', () => {
    expect(survivalBonus({ level: 1 }, 1800, 1)).toBe(0);
    expect(survivalBonus({ level: 500 }, 600, 1)).toBe(0);
    expect(survivalBonus({ level: 500 }, 1800, 1)).toBeGreaterThan(survivalBonus({ level: 500 }, 1200, 1));
    expect(survivalBonus({ level: 1000 }, 1800, 1)).toBeGreaterThan(survivalBonus({ level: 500 }, 1800, 1));
  });
});
