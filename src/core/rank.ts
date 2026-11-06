import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Clave de orden entre dos vecinos (null = extremo). Solo cambia el elemento movido.
 * Si los vecinos no están en orden estricto (posible tras sincronizar), se coloca justo después del anterior.
 */
export function rankBetween(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) return generateKeyBetween(before, null);
  return generateKeyBetween(before, after);
}

/** Orden por rank con desempate estable por id. */
export const compareRank = (a: { rank: string; id: string }, b: { rank: string; id: string }) =>
  a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.id.localeCompare(b.id);

/** n claves consecutivas, para ordenar por primera vez una lista entera. */
export const ranksFor = (n: number): string[] => generateNKeysBetween(null, null, n);
