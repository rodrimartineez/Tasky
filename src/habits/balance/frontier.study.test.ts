import { describe, it } from 'vitest';
import { WITHERED_WOODS } from '../../game/content/stages';
import { withUpgrades } from '../../game/content/upgrades';
import { botPlay } from '../../game/sim/bot';
import { levelHp } from '../../game/sim/difficulty';
import { BASE_STATS, RUN_SECONDS } from '../../game/sim/types';
import { createWorld, runResult } from '../../game/sim/world';
import { PROFILES, simulateEconomy, STREAK_RULES } from './economy';

/**
 * Estudio de la frontera de dificultad (ANALISIS_ECONOMIA.md §11). No es un test normal: tarda mucho. Se ejecuta con
 *   FRONTIER_OUT=salida.json FRONTIER_DAYS=1,7,30 npx vitest run src/habits/balance/frontier.study.test.ts
 * (varios procesos en paralelo, cada uno con sus días).
 *
 * Para las mejoras permanentes que tiene el perfil Constante en cada día, busca la dificultad F (multiplicador de vida
 * de los enemigos) más alta con la que el bot llega al minuto 30 en la mayoría de semillas, y guarda además el
 * tiempo y el oro de cada partida de la búsqueda (sirven para modelar el oro por intento).
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const OUT = env.FRONTIER_OUT;
const DAYS = (env.FRONTIER_DAYS ?? '1').split(',').map(Number);
const SEEDS = Number(env.FRONTIER_SEEDS ?? 3);
const STEPS = Number(env.FRONTIER_STEPS ?? 7);

/** Partida de nivel 1 con dureza total F (la densidad y el daño siguen a F: sim/difficulty.ts). */
const configFor = (F: number) => ({ level: 1, difficultyScale: F / levelHp(1) });

describe.skipIf(!OUT)('frontera de dificultad', () => {
  it(
    'busca la dificultad máxima superable por día',
    async () => {
      const profile = PROFILES[0];
      const days = simulateEconomy(profile, STREAK_RULES.hitos, Math.max(...DAYS), 7);
      const out: unknown[] = [];
      for (const day of DAYS) {
        const snap = days[day - 1];
        const stats = withUpgrades(BASE_STATS, snap.levels);
        const runs: { F: number; time: number; gold: number; passed: boolean }[] = [];
        const passes = (F: number) => {
          let ok = 0;
          for (let seed = 1; seed <= SEEDS; seed++) {
            const w = createWorld({
              seed: seed * 131 + day,
              stage: WITHERED_WOODS,
              stats,
              startingWeapon: 'spark',
              sprite: 'hero',
              ...configFor(F),
            });
            botPlay(w, RUN_SECONDS + 5);
            const r = runResult(w);
            runs.push({ F, time: r.time, gold: r.gold, passed: r.completed });
            if (r.completed) ok++;
          }
          return ok * 2 > SEEDS;
        };
        // Búsqueda en escala logarítmica entre 0,05 y 400.
        let lo = Math.log(0.05);
        let hi = Math.log(400);
        for (let i = 0; i < STEPS; i++) {
          const mid = (lo + hi) / 2;
          if (passes(Math.exp(mid))) lo = mid;
          else hi = mid;
        }
        out.push({ day, points: snap.totalPoints, levels: snap.levels, frontier: Math.exp(lo), runs });
      }
      // @ts-expect-error módulo de Node solo disponible al ejecutar el estudio
      (await import('node:fs')).writeFileSync(OUT, JSON.stringify(out));
    },
    24 * 3_600_000,
  );
});
