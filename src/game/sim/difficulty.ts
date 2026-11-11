/**
 * Dificultad por nivel: la partida n-ésima que juega el usuario es el nivel n (HABITS_GUIDE §5.4,
 * ANALISIS_ECONOMIA.md). Se suma a la escalada por minutos de cada partida.
 *
 * Crece como una potencia del nivel con exponente < 1: sin techo, pero cada vez más despacio, para que
 * la mejora del personaje (que crece con los puntos acumulados) pueda alcanzarla y nunca haya un callejón
 * sin salida. Los parámetros están juntos para poder ajustarlos con el estudio de equilibrio.
 */
export const DIFFICULTY = {
  /** Vida de los enemigos: ×(1 + hpA·(nivel−1)^exp). */
  hpA: 0.012,
  /** Daño de los enemigos: ×(1 + dmgA·(nivel−1)^exp). */
  dmgA: 0.006,
  exp: 0.86,
  /** Densidad de aparición: crece poco y con techo (el límite real es el rendimiento). */
  densityA: 0.004,
  densityMax: 1.6,
  /** Oro: los niveles altos pagan más, para que avanzar siempre compense. */
  goldA: 0.03,
  goldExp: 0.8,
};

const grow = (level: number, a: number, exp: number) => 1 + a * Math.pow(Math.max(0, level - 1), exp);

export const levelHp = (level: number) => grow(level, DIFFICULTY.hpA, DIFFICULTY.exp);
export const levelDamage = (level: number) => grow(level, DIFFICULTY.dmgA, DIFFICULTY.exp);
export const levelDensity = (level: number) => Math.min(DIFFICULTY.densityMax, 1 + DIFFICULTY.densityA * (level - 1));
export const levelGold = (level: number) => grow(level, DIFFICULTY.goldA, DIFFICULTY.goldExp);

/**
 * Bonificación de oro por supervivencia al acabar la partida (ANALISIS_ECONOMIA.md §10). Solo existe en niveles
 * altos (en el nivel 1 vale 0) y crece mucho con los minutos sobrevividos a partir del 10: la pagan las partidas
 * largas de un personaje fuerte, es decir, la constancia en los hábitos. Así los objetivos de millones de oro
 * son alcanzables en años para quien cumple, sin acelerar los primeros desbloqueos.
 */
export const SURVIVAL_BONUS = { perMinute: 9, fromMinute: 10, exp: 1.5 };

export function survivalBonus(level: number, seconds: number, greed: number): number {
  const minutes = Math.max(0, seconds / 60 - SURVIVAL_BONUS.fromMinute);
  return Math.floor((levelGold(level) - 1) * SURVIVAL_BONUS.perMinute * Math.pow(minutes, SURVIVAL_BONUS.exp) * greed);
}
