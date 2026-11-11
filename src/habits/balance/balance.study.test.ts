import { describe, it } from 'vitest';
import { WITHERED_WOODS } from '../../game/content/stages';
import { withUpgrades } from '../../game/content/upgrades';
import { botPlay } from '../../game/sim/bot';
import { BASE_STATS, RUN_SECONDS } from '../../game/sim/types';
import { createWorld, runResult } from '../../game/sim/world';
import { PROFILES, simulateEconomy, STREAK_RULES } from './economy';

/**
 * Estudio de equilibrio (no es un test normal: tarda minutos). Se ejecuta con
 *   BALANCE_OUT=ruta/salida.md npx vitest run src/habits/balance
 * y escribe las tablas de ANALISIS_ECONOMIA.md.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const OUT = env.BALANCE_OUT;
const DAYS = (env.BALANCE_DAYS ?? '1,30,90,180,365,730,1095').split(',').map(Number);
const SEEDS = Number(env.BALANCE_SEEDS ?? 2);

describe.skipIf(!OUT)('estudio de equilibrio', () => {
  it('partidas simuladas a lo largo de 3 años', async () => {
    const rule = STREAK_RULES[env.BALANCE_RULE ?? 'hitos'];
    const lines = [`| Perfil | Día | Nivel | Puntos | Poder · Vida · Celeridad | Supervivencia (min) | Oro |`, `|---|---|---|---|---|---|---|`];
    for (const profile of PROFILES.filter((p) => !env.BALANCE_PROFILES || env.BALANCE_PROFILES.split(',').some((n) => p.name.startsWith(n)))) {
      const days = simulateEconomy(profile, rule, Math.max(...DAYS), 7);
      for (const day of DAYS) {
        const snap = days[day - 1];
        const level = Math.max(1, snap.runs);
        const stats = withUpgrades(BASE_STATS, snap.levels);
        const times: number[] = [];
        const golds: number[] = [];
        for (let seed = 1; seed <= SEEDS; seed++) {
          const w = createWorld({ seed: seed * 97 + day, level, stage: WITHERED_WOODS, stats, startingWeapon: 'spark', sprite: 'hero' });
          botPlay(w, RUN_SECONDS);
          const r = runResult(w);
          times.push(r.time / 60);
          golds.push(r.gold);
        }
        const l = snap.levels;
        lines.push(
          `| ${profile.name} | ${day} | ${level} | ${snap.totalPoints} | ${l.might ?? 0} · ${l.maxHp ?? 0} · ${l.cooldown ?? 0} | ${times.map((t) => t.toFixed(1)).join(' / ')} | ${Math.round(golds.reduce((a, b) => a + b, 0) / golds.length)} |`,
        );
      }
    }
    // @ts-expect-error módulo de Node solo disponible al ejecutar el estudio
    (await import('node:fs')).writeFileSync(OUT, lines.join('\n') + '\n');
  }, 3_600_000);
});
