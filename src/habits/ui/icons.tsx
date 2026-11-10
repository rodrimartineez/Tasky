/** Iconos de píxel originales del modo Hábitos (cuadrícula 8×8, sin suavizado). */

export function FlameIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#c4502a" d="M3 0h1v1h1v1h1v1h1v4H6v1H2V7H1V3h1V2h1z" />
      <path fill="#ff9f3a" d="M3 2h1v1h1v1h1v3H2V4h1z" />
      <path fill="#ffe08a" d="M3 5h2v2H3z" />
    </svg>
  );
}

export function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#7a3a22" d="M1 1h6v4H6v1H5v1H3V6H2V5H1z" />
      <path fill="#ff8a5c" d="M2 2h4v3H5v1H3V5H2z" />
      <path fill="#ffc2a8" d="M2 2h2v1H2z" />
    </svg>
  );
}

export function SwordIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="#d8f5e3" d="M6 0h2v2H7v1H6v1H5v1H4V4H3V3h1V2h1V1h1z" />
      <path fill="#2c9a56" d="M1 4h1v1h1v1h1v1H3v1H2V7H1v1H0V7h1V6H0V5h1z" />
    </svg>
  );
}
