/**
 * Aspectos (Fase 10, propuestas D1 y C2): tintes y auras para cualquier personaje. Solo cambian cómo se ve. Unos se
 * compran con oro y otros se ganan con logros (`achievement`), nunca con puntos.
 */
export interface SkinDef {
  id: string;
  name: string;
  /** Tinte del sprite (multiplica sus colores). */
  tint: number;
  /** Color del aura bajo los pies (opcional). */
  aura?: number;
  /** Precio en oro (0 si solo se gana con un logro). */
  price: number;
  /** Logro que lo regala. */
  achievement?: string;
}

export const SKINS: SkinDef[] = [
  { id: 'ember', name: 'Brasa', tint: 0xffb38a, price: 15_000 },
  { id: 'frost', name: 'Escarcha', tint: 0xa8dcff, price: 15_000 },
  { id: 'moss', name: 'Musgo', tint: 0xb4f0a0, price: 30_000 },
  { id: 'shade', name: 'Sombra', tint: 0x9a8cc8, aura: 0x6a4fd0, price: 120_000 },
  { id: 'gilded', name: 'Dorado', tint: 0xffe08a, aura: 0xffc23d, price: 0, achievement: 'level_30' },
  { id: 'spirit', name: 'Espíritu', tint: 0xd8f4ff, aura: 0x7fe3ff, price: 0, achievement: 'streak_100' },
  { id: 'reaper', name: 'Segador', tint: 0xc9c2d6, aura: 0xe5484d, price: 0, achievement: 'level_100' },
];

export const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));
