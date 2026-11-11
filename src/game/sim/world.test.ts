import { describe, expect, it } from 'vitest';
import { WITHERED_WOODS } from '../content/stages';
import { WEAPONS } from '../content/weapons';
import { botPlay } from './bot';
import { runHp } from './difficulty';
import { BASE_STATS, RUN_SECONDS, type RunConfig, type Stats, type World } from './types';
import { weaponStatsAt } from './upgrades';
import { chooseUpgrade, createWorld, purgeItems, runResult, step, xpForLevel } from './world';

const DT = 1 / 60;
const config = (seed: number, stats: Stats = BASE_STATS, weapon = 'spark'): RunConfig => ({
  seed,
  level: 1,
  stage: WITHERED_WOODS,
  stats,
  startingWeapon: weapon,
  sprite: 'hero',
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
    // El nivel 1 se puede superar sin mejoras: la prueba usa una dureza mayor.
    const weak = createWorld({ ...config(3), difficultyScale: 6 });
    play(weak, RUN_SECONDS);
    expect(weak.phase).toBe('dead');
    expect(finite(weak)).toBe(true);
    const strong = createWorld({
      ...config(3, { ...BASE_STATS, might: 2.5, maxHp: 300, armor: 4, regen: 1.5, moveSpeed: 75 }),
      difficultyScale: 6,
    });
    play(strong, RUN_SECONDS);
    expect(strong.time).toBeGreaterThan(weak.time);
    expect(runResult(strong).gold).toBeGreaterThan(runResult(weak).gold);
  }, 60_000);

  it('al minuto 30 llega La Muerte, que acaba la partida sin remedio: el nivel queda superado', () => {
    const w = createWorld(config(2, { ...BASE_STATS, maxHp: 1e9, might: 50, revival: 3 }));
    w.time = RUN_SECONDS - 1;
    play(w, 20);
    expect(w.completed).toBe(true);
    expect(w.phase).toBe('dead');
    expect(w.player.stats.revival).toBe(0);
    const r = runResult(w);
    expect([r.won, r.completed, r.mode]).toEqual([true, true, 'normal']);
  });

  it('morir antes del minuto 30 no supera el nivel, pero el oro se conserva en el resultado', () => {
    const w = createWorld({ ...config(3), difficultyScale: 6 });
    play(w, RUN_SECONDS);
    expect(w.phase).toBe('dead');
    const r = runResult(w);
    expect([r.won, r.completed]).toEqual([false, false]);
    expect(r.gold).toBe(Math.floor(w.gold) + r.survivalBonus);
  }, 60_000);

  it('modo infinito: sin La Muerte, la partida sigue y siguen apareciendo enemigos; nunca supera niveles', () => {
    const w = createWorld({ ...config(4, { ...BASE_STATS, maxHp: 1e12, might: 200 }), mode: 'infinite' });
    w.time = RUN_SECONDS - 1;
    play(w, 60);
    expect(w.phase).not.toBe('dead');
    expect(w.completed).toBeFalsy();
    expect(w.enemies.some((e) => e.def.ai === 'reaper')).toBe(false);
    expect(w.enemies.length).toBeGreaterThan(0);
    expect(runResult(w).won).toBe(false);
  });

  it('modo reflejo: enemigos con el doble de vida; llegar al 30 no supera el nivel', () => {
    const mirror = createWorld({ ...config(5), mode: 'mirror' });
    expect(runHp(mirror.config)).toBeCloseTo(runHp(config(5)) * 2, 10);
    mirror.player.hp = mirror.player.stats.maxHp = 1e12;
    mirror.time = RUN_SECONDS - 1;
    play(mirror, 20);
    expect(runResult(mirror).completed).toBe(true);
    expect(runResult(mirror).won).toBe(false);
  });

  it('todas las armas funcionan como arma inicial', () => {
    for (const weapon of WEAPONS) {
      const w = createWorld(config(11, { ...BASE_STATS, maxHp: 1e6 }, weapon.id));
      // Camina en línea recta hacia los enemigos (las armas direccionales disparan hacia donde se mira).
      for (let i = 0; i < 60 / DT && w.phase !== 'dead'; i++) {
        if (w.phase === 'levelup')
          chooseUpgrade(
            w,
            Math.max(
              0,
              w.choices.findIndex((c) => c.kind !== 'purge'),
            ),
          );
        else if (w.phase === 'purge') purgeItems(w, [], []);
        else step(w, DT, 1, 0);
      }
      expect(w.player.weapons[0].dealt, weapon.name).toBeGreaterThan(0);
      expect(finite(w)).toBe(true);
    }
  }, 60_000);

  it('las armas tienen 7 niveles y sus valores son válidos', () => {
    for (const weapon of WEAPONS) {
      expect(weapon.levels).toHaveLength(6);
      const max = weaponStatsAt(weapon, 7);
      expect(max.cooldown).toBeGreaterThan(0.1);
      expect(max.damage).toBeGreaterThan(weapon.base.damage);
    }
  });

  it('la experiencia por nivel siempre crece', () => {
    for (let level = 1; level < 80; level++) expect(xpForLevel(level + 1)).toBeGreaterThan(xpForLevel(level));
  });
});

describe('revivir', () => {
  it('con revivir se vuelve con media vida en lugar de morir, una vez por carga', () => {
    const w = createWorld(config(3, { ...BASE_STATS, revival: 1 }));
    w.player.hp = -5;
    step(w, DT, 0, 0);
    expect(w.phase).not.toBe('dead');
    expect(w.player.hp).toBe(BASE_STATS.maxHp * 0.5);
    expect(w.player.stats.revival).toBe(0);
    w.player.hp = -5;
    step(w, DT, 0, 0);
    expect(w.phase).toBe('dead');
  });
});
