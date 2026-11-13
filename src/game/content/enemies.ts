import type { EnemyDef } from '../sim/types';

/** Enemigos. El comportamiento (`ai`) vive en sim/world.ts. */
export const ENEMIES: EnemyDef[] = [
  { id: 'slime', name: 'Limo', sprite: 'e_slime', hp: 8, speed: 28, damage: 6, radius: 6, xp: 1, ai: 'chase', knockResist: 0 },
  { id: 'bat', name: 'Murciélago', sprite: 'e_bat', hp: 5, speed: 54, damage: 5, radius: 5, xp: 1, ai: 'waver', knockResist: 0 },
  { id: 'bones', name: 'Osamenta', sprite: 'e_bones', hp: 22, speed: 34, damage: 9, radius: 6, xp: 2, ai: 'chase', knockResist: 0.2 },
  { id: 'shroom', name: 'Hongo saltarín', sprite: 'e_shroom', hp: 30, speed: 30, damage: 12, radius: 6, xp: 3, ai: 'charger', knockResist: 0.3 },
  { id: 'wisp', name: 'Fuego fatuo', sprite: 'e_wisp', hp: 16, speed: 50, damage: 8, radius: 5, xp: 2, ai: 'waver', knockResist: 0 },
  { id: 'thorn', name: 'Brote espinoso', sprite: 'e_thorn', hp: 26, speed: 26, damage: 8, radius: 6, xp: 3, ai: 'shooter', knockResist: 0.4 },
  { id: 'blob', name: 'Masa doble', sprite: 'e_blob', hp: 40, speed: 30, damage: 10, radius: 8, xp: 3, ai: 'chase', knockResist: 0.3, splitsInto: 'blobling' },
  { id: 'blobling', name: 'Masa menor', sprite: 'e_blobling', hp: 12, speed: 48, damage: 6, radius: 5, xp: 1, ai: 'chase', knockResist: 0 },
  { id: 'golem', name: 'Gólem de corteza', sprite: 'e_golem', hp: 160, speed: 20, damage: 18, radius: 10, xp: 10, ai: 'chase', knockResist: 0.8 },
  { id: 'elder', name: 'Roble Anciano', sprite: 'e_elder', hp: 1500, speed: 22, damage: 25, radius: 18, xp: 150, ai: 'boss', knockResist: 1 },
  { id: 'toad', name: 'Sapo escupidor', sprite: 'e_toad', hp: 34, speed: 22, damage: 9, radius: 7, xp: 3, ai: 'shooter', knockResist: 0.3 },
  { id: 'leech', name: 'Sanguijuela', sprite: 'e_leech', hp: 6, speed: 60, damage: 5, radius: 5, xp: 1, ai: 'chase', knockResist: 0 },
  { id: 'rat', name: 'Rata de cripta', sprite: 'e_rat', hp: 4, speed: 58, damage: 4, radius: 4, xp: 1, ai: 'chase', knockResist: 0 },
  { id: 'archer', name: 'Arquero óseo', sprite: 'e_archer', hp: 24, speed: 30, damage: 8, radius: 6, xp: 3, ai: 'volley', knockResist: 0.2 },
  { id: 'crystal', name: 'Guardián de cristal', sprite: 'e_crystal', hp: 90, speed: 16, damage: 14, radius: 9, xp: 6, ai: 'chase', knockResist: 0.85 },
  { id: 'imp', name: 'Diablillo de ceniza', sprite: 'e_imp', hp: 20, speed: 34, damage: 10, radius: 5, xp: 2, ai: 'charger', knockResist: 0.1 },
  // Jefes: uno por escenario, con sus propios esbirros.
  { id: 'bog_king', name: 'Rey del Pantano', sprite: 'e_bog_king', hp: 2800, speed: 20, damage: 28, radius: 18, xp: 150, ai: 'boss', knockResist: 1, minion: 'leech' },
  { id: 'bone_lord', name: 'Señor de los Huesos', sprite: 'e_bone_lord', hp: 3000, speed: 24, damage: 26, radius: 18, xp: 150, ai: 'boss', knockResist: 1, minion: 'rat' },
  { id: 'crystal_titan', name: 'Titán de Cristal', sprite: 'e_crystal_titan', hp: 4500, speed: 16, damage: 32, radius: 18, xp: 150, ai: 'boss', knockResist: 1, minion: 'imp' },
  { id: 'cinder_lord', name: 'Señor de la Ceniza', sprite: 'e_cinder_lord', hp: 3800, speed: 22, damage: 34, radius: 18, xp: 150, ai: 'boss', knockResist: 1, minion: 'archer' },
];

export const ENEMY_BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));
