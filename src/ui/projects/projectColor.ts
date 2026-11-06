/** Colores bien distinguibles sobre fondo oscuro. */
const PALETTE = ['#f87171', '#facc15', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#a3e635', '#fdba74'];

/** Color propio de cada proyecto, derivado de su id: el mismo en todos los dispositivos sin guardar nada más. */
export function projectColor(projectId: string): string {
  let hash = 0x811c9dc5; // FNV-1a
  for (const char of projectId) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
