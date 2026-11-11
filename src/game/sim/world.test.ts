import { describe, expect, it } from 'vitest';
import { WITHERED_WOODS } from '../content/stages';
import { WEAPONS } from '../content/weapons';
import { botPlay } from './bot';
import { BASE_STATS, RUN_SECONDS, type RunConfig, type Stats, type World } from './types';
import { weaponStatsAt } from './upgrades';
import { chooseUpgrade, createWorld, runResult, step, xpForLevel } from './world';

const DT = 1 / 60;
const config = (seed: number, stats: Stats = BASE_STATS, weapon = 'spark'): RunConfig => ({
  seed,
  level: 1,
  stage: WITHERED_WOODS,
  stats,
  startingWeapon: weapon,
});

const play = (w: World, seconds: number) => botPlay(w, seconds, DT);

const finite = (w: World) =>
  [w.player.x, w.player.y, w.player.hp, w.gold, ...w.enemies.flatMap((e) => [e.x, e.y, e.hp])].every(Number.isFinite);

describe('simulación', () => {
  it('es determinista: misma semilla, misma partida', () => {
    const a = createWorld(config(7));
    const b = createWorld(config(7));
    play(a, 90);
    play(b, 90);
    expect(runResult(a)).toEqual(runResult(b));
    const c = createWorld(config(8));
    play(c, 90);
    expect(runResult(c)).not.toEqual(runResult(a));
  });

  it('una partida guardada como JSON y reanudada sigue exactamente igual', () => {
    const original = createWorld(config(11));
    play(original, 60);
    const resumed = JSON.parse(JSON.stringify({ ...original, fx: [] })) as World;
    original.fx = [];
    play(original, 60);
    play(resumed, 60);
    expect(runResult(resumed)).toEqual(runResult(original));
  });

  it('aparecen enemigos, se gana experiencia y se sube de nivel', () => {
    const w = createWorld(config(1));
    play(w, 120);
    expect(w.kills).toBeGreaterThan(20);
    expect(w.player.level).toBeGreaterThan(2);
    expect(finite(w)).toBe(true);
  });

  it('sin mejoras la partida acaba en muerte; un personaje muy mejorado sobrevive más y gana más oro', () => {
    const weak = createWorld(config(3));
    play(weak, RUN_SECONDS);
    expect(weak.phase).toBe('dead');
    expect(finite(weak)).toBe(true);
    const strong = createWorld(config(3, { ...BASE_STATS, might: 2.5, maxHp: 300, armor: 4, regen: 1.5, moveSpeed: 75 }));
    play(strong, RUN_SECONDS);
    expect(strong.time).toBeGreaterThan(weak.time);
    expect(runResult(strong).gold).toBeGreaterThan(runResult(weak).gold);
  }, 60_000);

  it('la partida se gana al llegar a los 30 minutos', () => {
    const w = createWorld(config(2, { ...BASE_STATS, maxHp: 1e9, might: 50 }));
    w.time = RUN_SECONDS - 1;
    play(w, 3);
    expect(w.phase).toBe('won');
    expect(runResult(w).won).toBe(true);
  });

  it('todas las armas funcionan como arma inicial', () => {
    for (const weapon of WEAPONS) {
      const w = createWorld(config(11, { ...BASE_STATS, maxHp: 1e6 }, weapon.id));
      // Camina en línea recta hacia los enemigos (las armas direccionales disparan hacia donde se mira).
      for (let i = 0; i < 60 / DT && w.phase !== 'dead'; i++) {
        if (w.phase === 'levelup') chooseUpgrade(w, 0);
        else step(w, DT, 1, 0);
      }
      expect(w.player.weapons[0].dealt, weapon.name).toBeGreaterThan(0);
      expect(finite(w)).toBe(true);
    }
  });

  it('las armas tienen 8 niveles y sus valores son válidos', () => {
    for (const weapon of WEAPONS) {
      expect(weapon.levels).toHaveLength(7);
      const max = weaponStatsAt(weapon, 8);
      expect(max.cooldown).toBeGreaterThan(0.1);
      expect(max.damage).toBeGreaterThan(weapon.base.damage);
    }
  });

  it('la experiencia por nivel siempre crece', () => {
    for (let level = 1; level < 80; level++) expect(xpForLevel(level + 1)).toBeGreaterThan(xpForLevel(level));
  });
});
