import { ENEMY_BY_ID } from '../content/enemies';
import type { StageDef } from '../sim/types';
import { buildGroundTile, drawRows } from './atlas';
import { SPRITES } from './data';
import { GROUNDS } from './grounds';

/** Tamaño de la vista previa, en píxeles del juego (se amplía en la interfaz sin suavizado). */
const WIDTH = 176;
const HEIGHT = 99;
const cache = new Map<string, string>();

/**
 * Vista previa de un escenario con su arte real: su suelo, sus adornos, sus primeros enemigos, su jefe y el
 * personaje en el centro. Siempre igual para el mismo escenario (posiciones con semilla fija).
 */
export function stagePreviewUrl(stage: StageDef): string {
  const cached = cache.get(stage.id);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const ground = GROUNDS[stage.ground] ?? GROUNDS.t_grass;
  ctx.fillStyle = ctx.createPattern(buildGroundTile(ground), 'repeat')!;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  let seed = stage.id.length * 7919 + stage.ground.length;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const draw = (name: string, cx: number, by: number) => {
    const rows = SPRITES[name];
    if (rows) drawRows(ctx, rows, Math.round(cx - rows[0].length / 2), Math.round(by - rows.length), false);
  };
  // Lo de más arriba se dibuja antes: así lo de abajo queda delante.
  const items: { name: string; x: number; y: number }[] = [];
  for (let i = 0; i < 9; i++) {
    items.push({ name: stage.props[i % stage.props.length], x: 8 + rnd() * (WIDTH - 16), y: 14 + rnd() * (HEIGHT - 12) });
  }
  const enemies = [...new Set(stage.spawns.map((s) => s.enemy))].slice(0, 5);
  enemies.forEach((id, i) => {
    const angle = (i / enemies.length) * Math.PI * 2 + 0.6;
    const sprite = ENEMY_BY_ID.get(id)?.sprite;
    if (sprite) items.push({ name: sprite, x: WIDTH / 2 + Math.cos(angle) * 46, y: HEIGHT / 2 + 12 + Math.sin(angle) * 26 });
  });
  const boss = ENEMY_BY_ID.get(stage.events.find((e) => e.kind === 'boss')?.enemy ?? '')?.sprite;
  if (boss) items.push({ name: boss, x: WIDTH - 30, y: 40 });
  items.push({ name: 'hero_0', x: WIDTH / 2, y: HEIGHT / 2 + 12 });
  for (const item of items.sort((a, b) => a.y - b.y)) draw(item.name, item.x, item.y);

  const url = canvas.toDataURL();
  cache.set(stage.id, url);
  return url;
}
