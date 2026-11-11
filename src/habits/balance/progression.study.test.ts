import { describe, it } from 'vitest';
import { isBossLevel } from '../../game/content/bosses';
import { CHARACTERS } from '../../game/content/characters';
import { STAGES } from '../../game/content/stages';
import { DIFFICULTY, levelGold, levelHp, survivalBonus } from '../../game/sim/difficulty';
import { mulberry, PROFILES, simulateEconomy, STREAK_RULES } from './economy';

/**
 * Estudio de progresión (ANALISIS_ECONOMIA.md §11). No es un test normal. Se ejecuta con
 *   PROG_DIR=carpeta-de-frontier.study PROG_OUT=salida.md npx vitest run src/habits/balance/progression.study.test.ts
 *
 * 1. Ajusta una curva suave a la frontera medida (dureza máxima superable según los puntos gastados en mejoras).
 * 2. Ajusta la probabilidad de superar un nivel según lo lejos que está su dureza de la frontera, el tiempo de
 *    supervivencia de los intentos fallidos y el oro por minuto, con las partidas reales del estudio de frontera.
 * 3. Simula cada perfil día a día durante 3 años: intentos que dan sus hábitos, cuántos juega al día, niveles
 *    superados y oro. Variables: PROG_RULE (fórmula de puntos), PROG_CAPS (intentos jugados al día como mucho),
 *    PROG_BOSS (dureza extra equivalente de los niveles de jefe), PROG_SEEDS.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const DIR = env.PROG_DIR;
const OUT = env.PROG_OUT;
const RULE = env.PROG_RULE ?? 'hitos';
const CAPS = (env.PROG_CAPS ?? '1,2,99').split(',').map(Number);
const BOSS = Number(env.PROG_BOSS ?? 1);
const SEEDS = Number(env.PROG_SEEDS ?? 30);
const DAYS = 1095;

interface Run {
  F: number;
  time: number;
  gold: number;
  passed: boolean;
}
interface Point {
  day: number;
  points: number;
  frontier: number;
  runs: Run[];
}

/** Nivel de la curva anterior con el que se jugó cada partida del estudio (para descontar su oro). */
const oldLevel = (F: number) => (F <= 1 ? 1 : 1 + Math.pow((F - 1) / 0.012, 1 / 0.86));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

describe.skipIf(!DIR || !OUT)('estudio de progresión', () => {
  it('simula 3 años con la frontera medida', async () => {
    // @ts-expect-error módulos de Node solo disponibles al ejecutar el estudio
    const fs = await import('node:fs');
    // @ts-expect-error módulo de Node solo disponible al ejecutar el estudio
    const path = await import('node:path');
    const data: Point[] = fs
      .readdirSync(DIR)
      .filter((f: string) => f.endsWith('.json'))
      .flatMap((f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
      .sort((a: Point, b: Point) => a.day - b.day);

    // 1. Frontera suave: log F* = a + c·log(1 + P/b), mínimos cuadrados con b en rejilla.
    let fit = { a: 0, b: 1, c: 0, err: Infinity };
    for (let lb = Math.log(10); lb <= Math.log(50_000); lb += 0.05) {
      const b = Math.exp(lb);
      const xs = data.map((d) => Math.log(1 + d.points / b));
      const ys = data.map((d) => Math.log(d.frontier));
      const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
      const my = ys.reduce((s, y) => s + y, 0) / ys.length;
      const c = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
      const a = my - c * mx;
      const err = xs.reduce((s, x, i) => s + (a + c * x - ys[i]) ** 2, 0);
      if (err < fit.err) fit = { a, b, c, err };
    }
    const frontier = (points: number) => Math.exp(fit.a + fit.c * Math.log(1 + points / fit.b));

    // 2a. Probabilidad de llegar al minuto 30: σ((m − x)/w), x = log(dureza / frontera).
    const runs = data.flatMap((d) => d.runs.map((r) => ({ ...r, x: Math.log(r.F / frontier(d.points)) })));
    let logistic = { m: 0, w: 0.3, ll: -Infinity };
    for (let m = -0.6; m <= 0.6; m += 0.02)
      for (let w = 0.04; w <= 0.8; w += 0.02) {
        const ll = runs.reduce((s, r) => {
          const p = Math.min(1 - 1e-6, Math.max(1e-6, sigmoid((m - r.x) / w)));
          return s + Math.log(r.passed ? p : 1 - p);
        }, 0);
        if (ll > logistic.ll) logistic = { m, w, ll };
      }
    const passChance = (x: number) => sigmoid((logistic.m - x) / logistic.w);

    // 2b. Minutos de los intentos fallidos según x (por tramos).
    const bins = [-Infinity, -0.4, -0.2, 0, 0.2, 0.4, Infinity];
    const failTime = bins.slice(0, -1).map((lo, i) => {
      const inBin = runs.filter((r) => !r.passed && r.x >= lo && r.x < bins[i + 1]);
      return inBin.length ? inBin.reduce((s, r) => s + r.time, 0) / inBin.length : 900;
    });
    const timeWhenFailing = (x: number) => failTime[bins.findIndex((lo, i) => x >= lo && x < bins[i + 1])];

    // 2c. Oro base (sin la bonificación) por minuto jugado, en unidades de levelGold.
    const base = runs.map((r) => {
      const level = oldLevel(r.F);
      return { t: r.time, g: (r.gold - survivalBonus({ level }, r.time, 1)) / levelGold(level) };
    });
    const goldRate = base.reduce((s, r) => s + r.g, 0) / base.reduce((s, r) => s + r.t / 60, 0);
    const goldOf = (level: number, seconds: number) => levelGold(level) * goldRate * (seconds / 60) + survivalBonus({ level }, seconds, 1);

    // Precio acumulado de comprar todo, de lo más barato a lo más caro.
    const content = [...CHARACTERS.map((c) => ({ name: c.name, price: c.price })), ...STAGES.map((s) => ({ name: s.name, price: s.price }))]
      .filter((c) => c.price > 0)
      .sort((a, b) => a.price - b.price);
    let acc = 0;
    const milestones = content
      .map((c) => ({ name: c.name, total: (acc += c.price) }))
      .filter((c) => ['Fénix Renacido', 'Sol Eterno', 'Archimaga'].includes(c.name));

    // Curva sugerida: la dureza del nivel L sigue a la frontera del perfil Constante en su día L (con el desplazamiento
    // de la logística, para que a ese nivel tenga ~50 % por intento). Mínimos cuadrados en escala logarítmica.
    const constant = Array.from({ length: SEEDS }, (_, i) => simulateEconomy(PROFILES[0], STREAK_RULES[RULE], DAYS, i + 1));
    const target = Array.from(
      { length: DAYS },
      (_, d) => Math.log(frontier(constant.reduce((s, run) => s + run[d].totalPoints, 0) / SEEDS)) + logistic.m,
    );
    let curve = { base: 0, scale: 0, exp: 0, err: Infinity };
    for (let scale = 5; scale <= 400; scale *= 1.05)
      for (let exp = 0.2; exp <= 1.2; exp += 0.01) {
        // Con scale y exp fijos, log(base) óptimo es la media de las diferencias.
        const diffs = target.map((t, d) => t - exp * Math.log(1 + (d + 1) / scale));
        const lb = diffs.reduce((s, x) => s + x, 0) / DAYS;
        const err = diffs.reduce((s, x) => s + (x - lb) ** 2, 0);
        if (err < curve.err) curve = { base: Math.exp(lb), scale, exp, err };
      }

    const lines = [
      `Curva sugerida: ${curve.base.toFixed(3)}·(1 + L/${curve.scale.toFixed(1)})^${curve.exp.toFixed(2)} (error ${curve.err.toFixed(3)})`,
      '',
      `## Estudio de progresión (${new Date().toISOString().slice(0, 10)}, regla de puntos «${RULE}», jefes ×${BOSS})`,
      '',
      `Frontera ajustada: F*(P) = ${Math.exp(fit.a).toFixed(3)}·(1 + P/${fit.b.toFixed(0)})^${fit.c.toFixed(3)} · Curva de niveles: ${DIFFICULTY.base}·(1 + L/${DIFFICULTY.scale})^${DIFFICULTY.exp}`,
      `Probabilidad de llegar al 30: σ((${logistic.m.toFixed(2)} − x)/${logistic.w.toFixed(2)}), x = log(dureza/frontera) · Oro base: ${goldRate.toFixed(2)}·levelGold por minuto`,
      '',
      '| Perfil | Juega al día | Nivel día 30 / 90 / 365 / 730 / 1095 | Niveles al día (desde el día 30) | Días con 2+ / 3+ niveles | Intentos sin usar (día 1095) | Oro año 1 / 2 / 3 | Archimaga · Fénix · Sol Eterno (años) |',
      '|---|---|---|---|---|---|---|---|',
    ];

    for (const profile of PROFILES) {
      for (const cap of CAPS) {
        const levelsAt: Record<number, number[]> = { 30: [], 90: [], 365: [], 730: [], 1095: [] };
        let playDays = 0;
        let passTotal = 0;
        let two = 0;
        let three = 0;
        const bankEnd: number[] = [];
        const goldYears = [0, 0, 0];
        const reach = milestones.map(() => [] as number[]);
        for (let seed = 1; seed <= SEEDS; seed++) {
          const rng = mulberry(seed * 7919);
          const days = simulateEconomy(profile, STREAK_RULES[RULE], DAYS, seed);
          let level = 1;
          let bank = 0;
          let gold = 0;
          const reached = milestones.map(() => Infinity);
          for (const snap of days) {
            bank += snap.attempts;
            let passes = 0;
            const plays = profile.plays(snap.day) ? Math.min(bank, cap) : 0;
            for (let i = 0; i < plays; i++) {
              bank -= 1;
              const hard = levelHp(level) * (isBossLevel(level) ? BOSS : 1);
              const x = Math.log(hard / frontier(snap.totalPoints));
              const passed = rng() < passChance(x);
              const seconds = passed ? 1800 : timeWhenFailing(x);
              const earned = goldOf(level, seconds);
              gold += earned;
              goldYears[Math.min(2, Math.floor((snap.day - 1) / 365))] += earned / SEEDS;
              if (passed) {
                level += 1;
                passes += 1;
              }
            }
            if (snap.day > 30 && plays > 0) {
              playDays += 1;
              passTotal += passes;
              if (passes >= 2) two += 1;
              if (passes >= 3) three += 1;
            }
            milestones.forEach((m, i) => {
              if (gold >= m.total && reached[i] === Infinity) reached[i] = snap.day;
            });
            if (levelsAt[snap.day]) levelsAt[snap.day].push(level);
          }
          bankEnd.push(bank);
          reached.forEach((d, i) => reach[i].push(d));
        }
        const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
        const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
        const years = reach.map((r) => (median(r) === Infinity ? '—' : (median(r) / 365).toFixed(1)));
        lines.push(
          `| ${profile.name} | ${cap >= 99 ? 'todos' : cap} | ${Object.values(levelsAt)
            .map((l) => Math.round(avg(l)))
            .join(
              ' / ',
            )} | ${(passTotal / Math.max(1, playDays)).toFixed(2)} | ${((two / Math.max(1, playDays)) * 100).toFixed(0)} % / ${((three / Math.max(1, playDays)) * 100).toFixed(0)} % | ${Math.round(avg(bankEnd))} | ${goldYears.map((g) => `${(g / 1e6).toFixed(2)} M`).join(' / ')} | ${years.join(' · ')} |`,
        );
      }
    }
    fs.writeFileSync(OUT, lines.join('\n') + '\n');
  }, 3_600_000);
});
