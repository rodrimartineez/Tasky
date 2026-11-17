import { PRICE, UPGRADES } from '../../game/content/upgrades';

/**
 * Modelo de la economía a largo plazo para los estudios de equilibrio (ANALISIS_ECONOMIA.md §15).
 * No forma parte de la app: lo usan los *.study.test.ts.
 *
 * Simula día a día a un usuario que camina (1 punto de habilidad por paso, sin límites) y gasta los puntos en las
 * mejoras de combate (siempre la más barata de las que quiere).
 */

export interface Profile {
  name: string;
  /** Pasos de ese día. */
  steps(day: number, rng: () => number): number;
}

export function mulberry(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mejoras que el usuario quiere, en orden de preferencia (todas las de combate). */
const WANTED = UPGRADES.map((u) => u.id).filter((id) => !['greed', 'luck', 'pickup', 'growth', 'projSpeed'].includes(id));

export interface DaySnapshot {
  day: number;
  /** Puntos ganados ese día y acumulados (unidades actuales: 1 por paso). */
  points: number;
  totalPoints: number;
  /**
   * Puntos acumulados en las unidades de la economía anterior (puntos de hábito), con las que se midieron las
   * fronteras de dificultad (ANALISIS_ECONOMIA.md §11): los precios se multiplicaron por `PRICE`.
   */
  legacyPoints: number;
  levels: Record<string, number>;
}

/** Simula `days` días y devuelve una instantánea de cada día. */
export function simulateEconomy(profile: Profile, days: number, seed = 1): DaySnapshot[] {
  const rng = mulberry(seed);
  const levels: Record<string, number> = {};
  let wallet = 0;
  let total = 0;
  const out: DaySnapshot[] = [];

  for (let day = 1; day <= days; day++) {
    const points = Math.max(0, Math.round(profile.steps(day, rng)));
    wallet += points;
    total += points;
    // Gasta en la mejora deseada más barata mientras pueda.
    for (;;) {
      let best: string | null = null;
      let bestCost = Infinity;
      for (const id of WANTED) {
        const cost = UPGRADES.find((u) => u.id === id)!.cost((levels[id] ?? 0) + 1);
        if (cost < bestCost) {
          bestCost = cost;
          best = id;
        }
      }
      if (!best || bestCost > wallet) break;
      wallet -= bestCost;
      levels[best] = (levels[best] ?? 0) + 1;
    }
    out.push({ day, points, totalPoints: total, legacyPoints: total / PRICE, levels: { ...levels } });
  }
  return out;
}

/** Días normales alrededor de una media (±30 %). */
const around = (mean: number) => (_day: number, rng: () => number) => mean * (0.7 + 0.6 * rng());

/** Perfiles de usuario del estudio (referencia: ~7.000 pasos al día). */
export const PROFILES: Profile[] = [
  { name: 'Referencia (7.000 pasos)', steps: around(7000) },
  { name: 'Activo (12.000 pasos)', steps: around(12000) },
  { name: 'Sedentario (3.500 pasos)', steps: around(3500) },
  // Camina 7.000 de media, pero pasa 90 días casi sin moverse.
  { name: 'Pausa y vuelve', steps: (d, rng) => (d > 120 && d <= 210 ? 1000 : around(7000)(d, rng)) },
];
