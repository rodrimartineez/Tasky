import { describe, it } from 'vitest';
import { WITHERED_WOODS } from '../../game/content/stages';
import { withUpgrades } from '../../game/content/upgrades';
import { botPlay } from '../../game/sim/bot';
import { levelHp } from '../../game/sim/difficulty';
import { BASE_STATS } from '../../game/sim/types';
import { createWorld, runResult } from '../../game/sim/world';
import { PROFILES, simulateEconomy, STREAK_RULES } from './economy';

/**
 * Estudio de ritmo de partida (ANALISIS_ECONOMIA.md §12). No es un test normal. Se ejecuta con
 *   PACE_OUT=salida.md npx vitest run src/habits/balance/pace.study.test.ts
 *
 * Partidas «bien jugadas»: mejoras del perfil Constante en varios días y una dureza algo por debajo de su frontera
 * (§11.1), para que el bot llegue al minuto 30. Mide el nivel del personaje cada 5 minutos, enemigos eliminados,
 * enemigos en pantalla y coste de la simulación por paso.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const OUT = env.PACE_OUT;
const DAYS = (env.PACE_DAYS ?? '30,90,365').split(',').map(Number);
const SEEDS = Number(env.PACE_SEEDS ?? 3);
const SHARE = Number(env.PACE_SHARE ?? 0.8);
const frontier = (points: number) => 0.842 * Math.pow(1 + points / 1277, 0.633);

describe.skipIf(!OUT)('ritmo de partida', () => {
  it('nivel del personaje al minuto 30', async () => {
    // @ts-expect-error módulo de Node solo disponible al ejecutar el estudio
    const fs = await import('node:fs');
    const days = simulateEconomy(PROFILES[0], STREAK_RULES.hitos, Math.max(...DAYS), 7);
    const lines = [
      `## Ritmo de partida (${new Date().toISOString().slice(0, 10)}, dureza ${SHARE} × frontera)`,
      '',
      '| Día | Semilla | Llega al 30 | Nivel min 5 / 10 / 15 / 20 / 25 / 30 | Eliminados | Enemigos medios / máx. | ms por paso |',
      '|---|---|---|---|---|---|---|',
    ];
    for (const day of DAYS) {
      const snap = days[day - 1];
      const stats = withUpgrades(BASE_STATS, snap.levels);
      const F = frontier(snap.totalPoints) * SHARE;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const w = createWorld({
          seed: seed * 977 + day,
          stage: WITHERED_WOODS,
          stats,
          startingWeapon: 'spark',
          sprite: 'hero',
          level: 1,
          difficultyScale: F / levelHp(1),
        });
        const levels: number[] = [];
        let enemies = 0;
        let peak = 0;
        let samples = 0;
        const alive = () => w.phase !== 'dead';
        const started = performance.now();
        let steps = 0;
        for (let minute = 1; minute <= 30 && alive(); minute++) {
          for (let s = 0; s < 60 && alive(); s += 1) {
            botPlay(w, 1);
            steps += 60;
            enemies += w.enemies.length;
            peak = Math.max(peak, w.enemies.length);
            samples += 1;
          }
          if (minute % 5 === 0) levels.push(w.player.level);
        }
        const ms = (performance.now() - started) / steps;
        const r = runResult(w);
        lines.push(
          `| ${day} | ${seed} | ${w.time >= 1799 ? 'sí' : `no (${Math.floor(w.time / 60)} min)`} | ${levels.join(' / ')} | ${r.kills} | ${Math.round(enemies / Math.max(1, samples))} / ${peak} | ${ms.toFixed(2)} |`,
        );
      }
    }
    fs.writeFileSync(OUT, lines.join('\n') + '\n');
  }, 3_600_000);
});
