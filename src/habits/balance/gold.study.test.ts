import { describe, it } from 'vitest';
import { WITHERED_WOODS } from '../../game/content/stages';
import { withUpgrades } from '../../game/content/upgrades';
import { botPlay } from '../../game/sim/bot';
import { BASE_STATS, RUN_SECONDS } from '../../game/sim/types';
import { createWorld, runResult } from '../../game/sim/world';
import { PROFILES, simulateEconomy, STREAK_RULES } from './economy';

/**
 * Estudio de ingresos de oro (ANALISIS_ECONOMIA.md §10). Juega partidas con el bot en días de muestra y escribe,
 * por perfil, el oro medio por partida y la supervivencia. Se ejecuta con
 *   GOLD_OUT=ruta/salida.json npx vitest run src/habits/balance/gold
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const OUT = env.GOLD_OUT;
const DAYS = (env.GOLD_DAYS ?? '1,7,15,30,60,90,135,180,270,365,540,730,1095,1460').split(',').map(Number);
const SEEDS = Number(env.GOLD_SEEDS ?? 3);

describe.skipIf(!OUT)('estudio de ingresos de oro', () => {
  it('oro por partida a lo largo de 4 años', async () => {
    const out: Record<string, { day: number; gold: number; minutes: number; points: number }[]> = {};
    const profiles = PROFILES.filter((p) => !env.GOLD_PROFILES || env.GOLD_PROFILES.split(',').some((n) => p.name.startsWith(n)));
    for (const profile of profiles) {
      const days = simulateEconomy(profile, STREAK_RULES.hitos, Math.max(...DAYS), 7);
      out[profile.name] = DAYS.map((day) => {
        const snap = days[day - 1];
        const stats = withUpgrades(BASE_STATS, snap.levels);
        let gold = 0;
        let minutes = 0;
        for (let seed = 1; seed <= SEEDS; seed++) {
          const w = createWorld({ seed: seed * 131 + day, level: Math.max(1, snap.runs), stage: WITHERED_WOODS, stats, startingWeapon: 'spark', sprite: 'hero' });
          botPlay(w, RUN_SECONDS);
          const r = runResult(w);
          gold += r.gold / SEEDS;
          minutes += r.time / 60 / SEEDS;
        }
        return { day, gold: Math.round(gold), minutes: Math.round(minutes * 10) / 10, points: snap.totalPoints };
      });
    }
    // @ts-expect-error módulo de Node solo disponible al ejecutar el estudio
    (await import('node:fs')).writeFileSync(OUT, JSON.stringify(out, null, 1));
  }, 7_200_000);
});
