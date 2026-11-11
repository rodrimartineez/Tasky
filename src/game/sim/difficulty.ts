import type { RunConfig } from './types';

/**
 * Dificultad por nivel (HABITS_GUIDE §11, ANALISIS_ECONOMIA.md §11). Se suma a la escalada por minutos de cada partida.
 *
 * El nivel solo sube al superar uno (llegar al minuto 30), así que la curva marca el ritmo de avance: la dureza del
 * nivel L es la «frontera» medida para un jugador que cumple ~100 % de sus hábitos en su día L (la dificultad más
 * alta con la que aún llega al minuto 30). Así ese jugador supera de media un nivel al día, y quien cumple menos
 * avanza más despacio porque sus mejoras crecen más despacio. Sin techo, pero cada vez más despacio.
 *
 * Todo se expresa con un único factor de dureza H (vida de los enemigos ×H). El daño sube la mitad (1 + (H−1)/2) y la
 * densidad de aparición depende de H, no del número de nivel: así la frontera medida vale para cualquier nivel,
 * modalidad (reflejo = ×2) o estudio de equilibrio.
 */
export const DIFFICULTY = {
  /** Dureza del nivel L: base·(1 + L/scale)^exp. */
  base: 0.48,
  scale: 18,
  exp: 0.67,
  /** Densidad de aparición: crece con la dureza hasta un techo (el límite real es el rendimiento). */
  densityA: 0.004,
  densityMax: 1.6,
  /** Oro: los niveles altos pagan más, para que avanzar siempre compense. */
  goldA: 0.023,
  goldExp: 0.8,
};

/** Modo reflejo: dificultad doble (vida ×2, daño ×1,5) y el doble de oro. */
export const MIRROR_SCALE = 2;
const MIRROR_GOLD = 2;

/** Dureza de un nivel (sin modalidad). */
export const levelHp = (level: number) => DIFFICULTY.base * Math.pow(1 + Math.max(1, level) / DIFFICULTY.scale, DIFFICULTY.exp);
export const levelGold = (level: number) => 1 + DIFFICULTY.goldA * Math.pow(Math.max(0, level - 1), DIFFICULTY.goldExp);

/** El daño sube la mitad que la vida al endurecer (y baja igual al suavizar). */
const damageFor = (hp: number) => (hp >= 1 ? 1 + (hp - 1) / 2 : hp);
/**
 * Densidad según la dureza: equivale a +0,4 % por cada nivel de la curva anterior a la Fase 5d (con la que se midió
 * la frontera), hasta ×1,6.
 */
const densityFor = (hp: number) =>
  hp <= 1 ? 1 : Math.min(DIFFICULTY.densityMax, 1 + DIFFICULTY.densityA * Math.pow((hp - 1) / 0.012, 1 / 0.86));

/** Multiplicador de la partida: el de la modalidad por el explícito (estudios de equilibrio). */
const scaleOf = (config: RunConfig) => (config.difficultyScale ?? 1) * (config.mode === 'mirror' ? MIRROR_SCALE : 1);

/** Dureza, daño y densidad de los enemigos de una partida por su nivel y modalidad (sin la escalada por minutos). */
export const runHp = (config: RunConfig) => levelHp(config.level) * scaleOf(config);
export const runDamage = (config: RunConfig) => damageFor(runHp(config));
export const runDensity = (config: RunConfig) => densityFor(runHp(config));
export const runGold = (config: Pick<RunConfig, 'level' | 'mode'>) =>
  levelGold(config.level) * (config.mode === 'mirror' ? MIRROR_GOLD : 1);

/**
 * Bonificación de oro por supervivencia al acabar la partida (ANALISIS_ECONOMIA.md §10–11). Solo existe en niveles
 * altos (en el nivel 1 vale 0) y crece mucho con los minutos sobrevividos a partir del 10: la pagan las partidas
 * largas de un personaje fuerte, es decir, la constancia en los hábitos.
 */
export const SURVIVAL_BONUS = { perMinute: 5, fromMinute: 10, exp: 1.5 };

export function survivalBonus(config: Pick<RunConfig, 'level' | 'mode'>, seconds: number, greed: number): number {
  const minutes = Math.max(0, seconds / 60 - SURVIVAL_BONUS.fromMinute);
  const mode = config.mode === 'mirror' ? MIRROR_GOLD : 1;
  return Math.floor((levelGold(config.level) - 1) * SURVIVAL_BONUS.perMinute * Math.pow(minutes, SURVIVAL_BONUS.exp) * greed * mode);
}
