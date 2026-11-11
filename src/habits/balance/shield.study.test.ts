import { describe, it } from 'vitest';
import { PROFILES, simulateEconomy, STREAK_RULES } from './economy';

/**
 * Estudio del escudo de racha (solo puntos, sin combate: tarda segundos). Se ejecuta con
 *   SHIELD_OUT=ruta/salida.md npx vitest run src/habits/balance/shield
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const OUT = env.SHIELD_OUT;

describe.skipIf(!OUT)('estudio del escudo de racha', () => {
  it('puntos con distintas frecuencias de escudo', async () => {
    const options = [Infinity, 21, 30, 45, 60, 75, 90];
    const profiles = PROFILES.filter((p) => /^(Constante|Normal|Irregular)/.test(p.name));
    const lines = [
      `| Escudo cada | ${profiles.map((p) => `${p.name} 1 año / 3 años`).join(' | ')} | Normal vs sin escudo (1 año) | Constante / Irregular (1 año) |`,
      `|---|${profiles.map(() => '---').join('|')}|---|---|`,
    ];
    const at = (every: number, profileIndex: number, day: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 20; seed++) sum += simulateEconomy(profiles[profileIndex], STREAK_RULES.hitos, 1095, seed, every)[day - 1].totalPoints;
      return Math.round(sum / 20);
    };
    const normalBase = at(Infinity, 1, 365);
    for (const every of options) {
      const cells = profiles.map((_, i) => `${at(every, i, 365).toLocaleString('es-ES')} / ${at(every, i, 1095).toLocaleString('es-ES')}`);
      const normalGain = ((at(every, 1, 365) / normalBase - 1) * 100).toFixed(1);
      const ratio = (at(every, 0, 365) / at(every, 2, 365)).toFixed(1);
      lines.push(`| ${every === Infinity ? 'sin escudo' : `${every} días`} | ${cells.join(' | ')} | +${normalGain} % | ${ratio}× |`);
    }
    // @ts-expect-error módulo de Node solo disponible al ejecutar el estudio
    (await import('node:fs')).writeFileSync(OUT, lines.join('\n') + '\n');
  }, 600_000);
});
