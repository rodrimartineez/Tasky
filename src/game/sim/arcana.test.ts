import { describe, expect, it } from 'vitest';
import { ARCANA } from '../content/arcana';
import { ENEMY_BY_ID } from '../content/enemies';
import { buildRunConfig } from '../content/run';
import { damageEnemy, hasArcana, heal, rebuildGrid, spawnEnemy } from './core';
import { recomputeStats } from './upgrades';
import { createWorld, step } from './world';
import { updateWeapons } from './weapons';

const DT = 1 / 60;
const world = (arcana: string[], character = 'wanderer') => createWorld(buildRunConfig(10, character, 'withered_woods', {}, { arcana }));

describe('arcanas y darkanas', () => {
  it('las 8 cartas existen y se limitan a dos por partida', () => {
    expect(ARCANA).toHaveLength(8);
    expect(ARCANA.filter((a) => a.dark).map((a) => a.id)).toEqual(['sapphire', 'heir']);
    expect(buildRunConfig(1, 'wanderer', 'withered_woods', {}, { arcana: ['chaos', 'tragic', 'waltz'] }).arcana).toEqual(['chaos', 'tragic']);
    expect(hasArcana(world(['chaos']), 'chaos')).toBe(true);
    expect(hasArcana(world([]), 'chaos')).toBe(false);
  });

  it('Principio: +1 proyectil en general', () => {
    const base = world([]);
    expect(world(['beginning']).player.stats.amount).toBe(base.player.stats.amount + 1);
  });

  it('Sarabanda de la curación: duplica la curación y daña a los enemigos cercanos', () => {
    const w = world(['sarabande']);
    const e = spawnEnemy(w, ENEMY_BY_ID.get('slime')!, w.player.x + 20, w.player.y);
    e.hp = 1000;
    w.player.hp = 10;
    rebuildGrid(w);
    heal(w, 10);
    expect(w.player.hp).toBe(30);
    expect(e.hp).toBeLessThan(1000);
    const plain = world([]);
    plain.player.hp = 10;
    heal(plain, 10);
    expect(plain.player.hp).toBe(20);
  });

  it('Princesa trágica: las armas se recargan más rápido al moverse', () => {
    const slow = world([]);
    const fast = world(['tragic']);
    for (const w of [slow, fast]) {
      w.player.weapons[0].timer = 100;
      w.player.moving = true;
      step(w, 1, 1, 0);
    }
    expect(fast.player.weapons[0].timer).toBeLessThan(slow.player.weapons[0].timer);
  });

  it('Niebla de zafiro: a veces el arma vuelve a atacar casi al instante', () => {
    const w = world(['sapphire']);
    let quick = 0;
    for (let i = 0; i < 200; i++) {
      w.player.weapons[0].timer = 0;
      updateWeapons(w, DT);
      if (w.player.weapons[0].timer <= 0.15) quick += 1;
    }
    expect(quick).toBeGreaterThan(20);
    expect(quick).toBeLessThan(120);
  });

  it('Heredero del destino: las bajas con fuego dan vida máxima y daño', () => {
    const w = world(['heir']);
    w.player.weapons[0].id = 'firewand';
    const maxHp = w.player.stats.maxHp;
    const might = w.player.stats.might;
    for (let i = 0; i < 25; i++) {
      const e = spawnEnemy(w, ENEMY_BY_ID.get('slime')!, w.player.x + 5, w.player.y);
      damageEnemy(w, e, 9999, 0, 0, 0);
    }
    recomputeStats(w);
    expect(w.player.heirSteps).toBe(1);
    expect(w.player.stats.maxHp).toBe(maxHp + 1);
    expect(w.player.stats.might).toBeCloseTo(might + 0.004);
  });

  it('Vals de perlas: el proyectil rebota hacia otro enemigo en vez de morir', () => {
    const w = world(['waltz']);
    const a = spawnEnemy(w, ENEMY_BY_ID.get('slime')!, w.player.x + 30, w.player.y);
    const b = spawnEnemy(w, ENEMY_BY_ID.get('slime')!, w.player.x + 30, w.player.y + 100);
    a.hp = b.hp = 1e6;
    w.projectiles.push({ kind: 'bolt', sprite: 'x_thorn', weapon: 0, x: a.x, y: a.y, vx: 100, vy: 0, damage: 1, radius: 8, life: 1, pierce: 1, knockback: 0, angle: 0, orbitR: 0, sx: 0, sy: 0, tx: 0, ty: 0, total: 1, hit: [], dead: false, bounces: 3 });
    step(w, DT, 0, 0);
    const p = w.projectiles[0];
    expect(p.dead).toBe(false);
    expect(p.bounces).toBe(2);
    expect(p.vy).toBeGreaterThan(0);
  });
});
