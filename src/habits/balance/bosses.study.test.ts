import { describe, it } from 'vitest';
import { CYCLE_BOSSES } from '../../game/content/bosses';
import { WITHERED_WOODS } from '../../game/content/stages';
import { withUpgrades } from '../../game/content/upgrades';
import { botPlay } from '../../game/sim/bot';
import { levelHp } from '../../game/sim/difficulty';
import { BASE_STATS, RUN_SECONDS } from '../../game/sim/types';
import { createWorld, runResult } from '../../game/sim/world';
import { PROFILES, simulateEconomy, STREAK_RULES } from './economy';

/**
 * Estudio de los jefes de ciclo (ANALISIS_ECONOMIA.md §11). No es un test normal. Se ejecuta con
 *   BOSS_OUT=salida.json BOSS_INDEX=0 npx vitest run src/habits/balance/bosses.study.test.ts
 *
 * Con las mejoras del perfil Constante en cada día y la dureza de su frontera (FRONTIER, ajuste del estudio de
 * progresión), juega una partida con el jefe indicado y anota si llega al minuto 30, si vence al jefe y cuándo.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const OUT = env.BOSS_OUT;
const INDEX = Number(env.BOSS_INDEX ?? 0);
const ROUND = Number(env.BOSS_ROUND ?? 0);
const DAYS = (env.BOSS_DAYS ?? '14,30,60,90,180,365,730').split(',').map(Number);
const SEEDS = Number(env.BOSS_SEEDS ?? 2);
/** Frontera ajustada: dureza con ~50 % de llegar al minuto 30 según los puntos gastados (ANALISIS §11). */
const FRONTIER = (points: number) => 0.797 * Math.pow(1 + points / 1484, 0.588) * Math.exp(0.06);

describe.skipIf(!OUT)('jefes de ciclo', () => {
  it(
    '¿se vence al jefe en la frontera?',
    async () => {
      const days = simulateEconomy(PROFILES[0], STREAK_RULES.hitos, Math.max(...DAYS), 7);
      const boss = CYCLE_BOSSES[INDEX];
      const out: unknown[] = [];
      for (const day of DAYS) {
        const snap = days[day - 1];
        const hard = FRONTIER(snap.totalPoints);
        for (let seed = 1; seed <= SEEDS; seed++) {
          const w = createWorld({
            seed: seed * 977 + day,
            level: 7,
            difficultyScale: hard / levelHp(7),
            stage: WITHERED_WOODS,
            stats: withUpgrades(BASE_STATS, snap.levels),
            startingWeapon: 'spark',
            sprite: 'hero',
            cycleBoss: { id: boss.id, round: ROUND },
          });
          let killedAt: number | null = null;
          while (w.phase !== 'dead' && w.time < RUN_SECONDS + 5) {
            botPlay(w, 1);
            if (killedAt === null && w.cycleBoss === 2) killedAt = w.time;
          }
          const r = runResult(w);
          out.push({ boss: boss.id, day, seed, completed: r.completed, killed: w.cycleBoss === 2, killedAt, time: r.time });
        }
      }
      // @ts-expect-error módulo de Node solo disponible al ejecutar el estudio
      (await import('node:fs')).writeFileSync(OUT, JSON.stringify(out));
    },
    24 * 3_600_000,
  );
});
