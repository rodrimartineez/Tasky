import { chooseUpgrade, step } from './world';
import type { World } from './types';

/**
 * Jugador automático para probar y equilibrar sin pantalla (tests y simulador de economía).
 * Juega «razonablemente»: se aleja del conjunto de enemigos cercanos girando a su alrededor,
 * va a por los objetos cuando no hay peligro y elige siempre la primera mejora.
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

/** Juega `seconds` segundos de partida (o hasta que termine). */
export function botPlay(w: World, seconds: number, dt = 1 / 60) {
  const until = w.time + seconds;
  while (w.time < until && (w.phase === 'playing' || w.phase === 'levelup')) {
    if (w.phase === 'levelup') {
      chooseUpgrade(w, 0);
      continue;
    }
    const move = botMove(w);
    step(w, dt, move.x, move.y);
  }
}
