import { describe, it } from 'vitest';
import { levelHp } from '../../game/sim/difficulty';
import { type BountyPlan, PROFILES, simulateEconomy, STREAK_RULES } from './economy';

/**
 * Estudio de la mejora de recompensas «Constancia» (ANALISIS_ECONOMIA.md §13). No es un test normal:
 *   BOUNTY_OUT=salida.md npx vitest run src/habits/balance/bounty.study.test.ts
 *
 * Para cada perfil, curva de costes y estrategia de compra (nunca / primero / la más barata) mide, de media en
 * varias semillas: cuándo se alcanza cada nivel, puntos ganados, puntos que acaban en mejoras de combate y el
 * nivel de partida aproximado que permiten (el más alto cuya dureza no supera la frontera F*(P) del §11).
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const OUT = env.BOUNTY_OUT;
const SEEDS = Number(env.BOUNTY_SEEDS ?? 12);
const DAYS = 730;
const CHECKS = [30, 90, 180, 365, 730];
const CURVES: Record<string, number[]> = {
  A: [21, 60, 150, 320],
  E: [21, 80, 220, 500],
  F: [21, 75, 200, 450],
  B: [21, 90, 270, 640],
  C: [21, 120, 400, 1000],
  D: [21, 63, 189, 567],
};
const frontier = (points: number) => 0.842 * Math.pow(1 + points / 1277, 0.633);
/** Nivel de partida más alto que se puede superar con P puntos en combate (aproximado). */
function reachable(points: number): number {
  const F = frontier(points);
  let level = 1;
  while (levelHp(level + 1) <= F && level < 9999) level += 1;
  return level;
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe.skipIf(!OUT)('mejora de recompensas', () => {
  it('costes y estrategias', async () => {
    // @ts-expect-error módulo de Node solo disponible al ejecutar el estudio
    const fs = await import('node:fs');
    const lines: string[] = [`## Mejora de recompensas (${new Date().toISOString().slice(0, 10)}, ${SEEDS} semillas, 2 años)`, ''];
    for (const profile of PROFILES.slice(0, 4)) {
      lines.push(`### ${profile.name}`, '');
      lines.push(
        '| Curva | Estrategia | Día nivel 1 / 2 / 3 / 4 | Puntos ganados día 90 / 365 / 730 | En combate día 30 / 90 / 180 / 365 / 730 | Nivel de partida día 90 / 365 / 730 |',
        '|---|---|---|---|---|---|',
      );
      const plans: [string, BountyPlan | undefined][] = [['—', undefined]];
      for (const [name, costs] of Object.entries(CURVES))
        for (const strategy of ['first', 'cheapest'] as const) plans.push([`${name} ${costs.join('/')}`, { costs, strategy }]);
      for (const [name, plan] of plans) {
        const runs = Array.from({ length: SEEDS }, (_, i) => simulateEconomy(profile, STREAK_RULES.hitos, DAYS, i + 1, undefined, plan));
        const reach = [1, 2, 3, 4].map((l) => {
          const days = runs.map((r) => r.find((d) => d.bounty >= l)?.day ?? Infinity);
          const m = median(days);
          return Number.isFinite(m) ? String(m) : '—';
        });
        const at = (day: number, f: (d: (typeof runs)[0][0]) => number) => Math.round(avg(runs.map((r) => f(r[day - 1]))));
        const combat = (d: (typeof runs)[0][0]) => d.totalPoints - d.bountySpent;
        lines.push(
          `| ${name} | ${plan ? (plan.strategy === 'first' ? 'primero' : 'la más barata') : 'nunca'} | ${reach.join(' / ')} | ${[90, 365, 730].map((d) => at(d, (x) => x.totalPoints)).join(' / ')} | ${CHECKS.map((d) => at(d, combat)).join(' / ')} | ${[90, 365, 730].map((d) => reachable(at(d, combat))).join(' / ')} |`,
        );
      }
      lines.push('');
    }
    fs.writeFileSync(OUT, lines.join('\n') + '\n');
  }, 600_000);
});
