import { EVOLUTIONS } from '../content/evolutions';
import { chooseUpgrade, purgeItems, step } from './world';
import type { Phase, UpgradeChoice, World } from './types';

/**
 * Jugador automático para probar y equilibrar sin pantalla (tests y simulador de economía).
 * Juega «razonablemente»: se aleja del conjunto de enemigos cercanos girando a su alrededor,
 * va a por los objetos cuando no hay peligro y elige las mejoras como una persona que busca evoluciones (`botPick`).
 */
const DANGER = 80;

export function botMove(w: World): { x: number; y: number } {
  const p = w.player;
  let ax = 0;
  let ay = 0;
  for (const e of w.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > DANGER + e.radius) continue;
    // Cuanto más cerca, más empuja.
    const push = (DANGER + e.radius - d) / DANGER;
    ax += (dx / d) * push * push;
    ay += (dy / d) * push * push;
  }
  for (const s of w.projectiles) {
    if (s.kind !== 'enemyShot') continue;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 40) {
      ax += (dx / d) * 0.5;
      ay += (dy / d) * 0.5;
    }
  }
  const threat = Math.hypot(ax, ay);
  if (threat > 0.02) {
    // Huye con un componente lateral para rodear al grupo en vez de correr en línea recta.
    return { x: ax / threat - (ay / threat) * 0.6, y: ay / threat + (ax / threat) * 0.6 };
  }
  // Sin peligro: recoge lo más cercano.
  let best = 140 * 140;
  let tx = 0;
  let ty = 0;
  for (const item of w.pickups) {
    const dx = item.x - p.x;
    const dy = item.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < best) {
      best = d;
      tx = dx;
      ty = dy;
    }
  }
  if (tx !== 0 || ty !== 0) return { x: tx, y: ty };
  return { x: Math.cos(w.time * 0.4), y: Math.sin(w.time * 0.4) };
}

/**
 * Elección de mejora «de persona» (Fase 8: el bot que elegía siempre la primera opción era mucho más débil que un
 * jugador real y la dificultad quedaba baja): primero lo que completa una evolución, luego subir las armas que ya
 * tienen su pasiva, las pasivas que piden sus armas, el resto de armas y, al final, lo demás. Nunca la Purga.
 */
export function botPick(w: World): number {
  const owned = new Set(w.player.weapons.map((x) => x.id));
  const passives = new Set(w.player.passives.map((x) => x.id));
  const score = (c: UpgradeChoice) => {
    if (c.kind === 'evolution' || c.evolves) return 100;
    if (c.kind === 'weapon') {
      const evo = EVOLUTIONS.find((e) => e.weapon === c.id);
      if (owned.has(c.id)) return evo && passives.has(evo.passive) ? 60 : 40;
      return evo ? 35 : 20;
    }
    if (c.kind === 'passive') return EVOLUTIONS.some((e) => e.passive === c.id && owned.has(e.weapon)) ? 50 : 15;
    return c.kind === 'purge' ? -1 : 0;
  };
  let best = 0;
  w.choices.forEach((c, i) => {
    if (score(c) > score(w.choices[best])) best = i;
  });
  return best;
}

/** Elección neutra (la primera opción que no sea la Purga): para medir cada arma sin favorecer ninguna. */
export const firstPick = (w: World) =>
  Math.max(
    0,
    w.choices.findIndex((c) => c.kind !== 'purge'),
  );

/** Juega `seconds` segundos de partida (o hasta que termine). `pick`: cómo elige las mejoras. */
export function botPlay(w: World, seconds: number, dt = 1 / 60, pick: (w: World) => number = botPick) {
  const until = w.time + seconds;
  while (w.time < until && (w.phase === 'playing' || w.phase === 'levelup')) {
    if (w.phase === 'levelup') {
      // El bot nunca usa la mejora de eliminar: si es lo único que hay, la cierra sin quitar nada.
      chooseUpgrade(w, pick(w));
      if ((w.phase as Phase) === 'purge') purgeItems(w, [], []);
      continue;
    }
    const move = botMove(w);
    step(w, dt, move.x, move.y);
  }
}
