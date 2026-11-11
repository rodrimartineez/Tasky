import { describe, expect, it } from 'vitest';
import { CYCLE_BOSSES, CYCLE_BOSS_AT, cycleBossFor, isBossLevel } from '../content/bosses';
import { WITHERED_WOODS } from '../content/stages';
import { SPRITES } from '../sprites/data';
import { patternsOf } from './bosses';
import { damageEnemy } from './core';
import { BASE_STATS, RUN_SECONDS, type RunConfig, type World } from './types';
import { chooseUpgrade, createWorld, runResult, step } from './world';

const DT = 1 / 60;
const run = (w: World, seconds: number) => {
  for (let i = 0; i < seconds / DT && w.phase !== 'dead'; i++) {
    if (w.phase === 'levelup') chooseUpgrade(w, 0);
    else step(w, DT, Math.cos(i / 90), Math.sin(i / 90));
  }
};
const bossLevel = (level: number, stats = BASE_STATS): RunConfig => ({
  seed: 3,
  level,
  stage: WITHERED_WOODS,
  stats,
  startingWeapon: 'spark',
  sprite: 'hero',
  cycleBoss: cycleBossFor(level)!,
});
const bossOf = (w: World) => w.enemies.find((e) => e.def.patterns);

describe('jefes de ciclo', () => {
  it('cada 7 niveles hay un jefe; los 10 se alternan y luego vuelven con la vuelta siguiente', () => {
    expect([6, 7, 8, 13, 14].map(isBossLevel)).toEqual([false, true, false, false, true]);
    expect(CYCLE_BOSSES).toHaveLength(10);
    const ids = Array.from({ length: 10 }, (_, i) => cycleBossFor((i + 1) * 7)!.id);
    expect(new Set(ids).size).toBe(10);
    expect(cycleBossFor(77)).toEqual({ id: ids[0], round: 1 });
    expect(cycleBossFor(147)).toEqual({ id: ids[0], round: 2 });
    for (const b of CYCLE_BOSSES) expect(SPRITES[b.sprite], b.name).toBeDefined();
    expect(SPRITES.e_reaper).toBeDefined();
  });

  it('aparece en el minuto 20; sin vencerlo, llegar al 30 no supera el nivel', () => {
    const w = createWorld(bossLevel(7, { ...BASE_STATS, maxHp: 1e12, might: 0.001 }));
    w.time = CYCLE_BOSS_AT - 1;
    run(w, 3);
    expect(w.cycleBoss).toBe(1);
    expect(bossOf(w)).toBeDefined();
    w.time = RUN_SECONDS - 1;
    run(w, 20);
    expect(runResult(w)).toMatchObject({ completed: true, won: false });
  });

  it('venciéndolo y llegando al 30, el nivel queda superado', () => {
    const w = createWorld(bossLevel(7, { ...BASE_STATS, maxHp: 1e12 }));
    w.time = CYCLE_BOSS_AT - 1;
    run(w, 2);
    damageEnemy(w, bossOf(w)!, 1e15, 0, 0, 0);
    expect(w.cycleBoss).toBe(2);
    w.time = RUN_SECONDS - 1;
    run(w, 20);
    expect(runResult(w)).toMatchObject({ completed: true, won: true });
  });

  it('en vueltas posteriores son más duros y suman ataques nuevos', () => {
    const first = createWorld(bossLevel(7));
    const third = createWorld({ ...bossLevel(7), cycleBoss: { id: cycleBossFor(7)!.id, round: 2 } });
    for (const w of [first, third]) {
      w.time = CYCLE_BOSS_AT - 1;
      run(w, 2);
    }
    const a = bossOf(first)!;
    const b = bossOf(third)!;
    expect(b.maxHp).toBeGreaterThan(a.maxHp * 1.4);
    expect(patternsOf(b, 2).length).toBeGreaterThan(patternsOf(a, 0).length);
  });

  it('todos los jefes y sus ataques funcionan en todas las vueltas sin valores inválidos', () => {
    for (let i = 0; i < 30; i++) {
      const level = (i + 1) * 7;
      const w = createWorld(bossLevel(level, { ...BASE_STATS, maxHp: 1e12 }));
      w.time = CYCLE_BOSS_AT - 1;
      run(w, 45);
      const boss = bossOf(w);
      expect(boss, `nivel ${level}`).toBeDefined();
      expect([boss!.x, boss!.y, boss!.hp, w.player.x, w.player.y].every(Number.isFinite), `nivel ${level}`).toBe(true);
    }
  }, 120_000);
});
