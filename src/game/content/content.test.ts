import { describe, expect, it } from 'vitest';
import { botPlay } from '../sim/bot';
import { BASE_STATS, MAX_PASSIVES, MAX_WEAPONS, type World } from '../sim/types';
import { createWorld } from '../sim/world';
import { resolveSprite, SPRITES } from '../sprites/data';
import { CHARACTERS } from './characters';
import { ENEMY_BY_ID, ENEMIES } from './enemies';
import { PASSIVES } from './passives';
import { buildRunConfig } from './run';
import { STAGES } from './stages';
import { WEAPON_BY_ID, WEAPONS } from './weapons';

const finite = (w: World) =>
  [w.player.x, w.player.y, w.player.hp, w.gold, ...w.enemies.flatMap((e) => [e.x, e.y, e.hp])].every(Number.isFinite);

describe('contenido', () => {
  it('hay 16 personajes con precios crecientes, armas y sprites que existen', () => {
    expect(CHARACTERS).toHaveLength(16);
    expect(CHARACTERS[0].price).toBe(0);
    expect(CHARACTERS.map((c) => c.price)).toEqual([0, 400, 800, 1500, 2500, 4000, 6000, 8500, 12000, 16000, 21000, 27000, 34000, 42000, 52000, 65000]);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(16);
    expect(new Set(CHARACTERS.map((c) => c.sprite)).size).toBe(16);
    expect(new Set(CHARACTERS.map((c) => c.weapon)).size).toBeGreaterThanOrEqual(10);
    for (const c of CHARACTERS) {
      expect(WEAPON_BY_ID.has(c.weapon), `${c.name}: arma ${c.weapon}`).toBe(true);
      expect(SPRITES[`${c.sprite}_0`], `${c.name}: fotograma 0`).toBeDefined();
      expect(SPRITES[`${c.sprite}_1`], `${c.name}: fotograma 1`).toBeDefined();
    }
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
    expect(STAGES.map((s) => s.price)).toEqual([0, 5000, 15000, 35000, 70000]);
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
    for (const w of WEAPONS) expect(SPRITES[resolveSprite(w.icon)], w.name).toBeDefined();
    for (const p of PASSIVES) expect(SPRITES[resolveSprite(p.icon)], p.name).toBeDefined();
  });

  it('hay 5 huecos de armas y de pasivas y variedad de armas y pasivas', () => {
    expect(MAX_WEAPONS).toBe(5);
    expect(MAX_PASSIVES).toBe(5);
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
      expect(w.enemies.some((e) => e.def.ai === 'boss'), stage.name).toBe(true);
      expect(finite(w)).toBe(true);
    }
  }, 30_000);
});

describe('equilibrio de armas', () => {
  // Daño de cada arma como inicial en 5 min con un personaje sin mejoras y casi inmortal: ninguna debe pasar de ~2× la mejor de las originales.
  const ORIGINAL = ['spark', 'lance', 'orbs', 'ember', 'storm', 'flask'];
  const dealt = (weapon: string) => {
    const w = createWorld({ seed: 21, level: 1, stage: STAGES[0], stats: { ...BASE_STATS, maxHp: 1e6 }, startingWeapon: weapon, sprite: 'hero' });
    botPlay(w, 300);
    return w.player.weapons.find((x) => x.id === weapon)?.dealt ?? 0;
  };

  it('ninguna arma nueva supera el doble de la mejor original', () => {
    const results = new Map(WEAPONS.map((w) => [w.id, dealt(w.id)]));
    const best = Math.max(...ORIGINAL.map((id) => results.get(id)!));
    for (const [id, d] of results) {
      expect(d, id).toBeGreaterThan(0);
      expect(d, id).toBeLessThan(best * 2);
    }
  }, 120_000);
});
