import { useId } from 'react';

/** Marca «Sello»: un único trazo escribe «tsk» y, sin levantarse, rodea la palabra cerrando un círculo. */
export const LOGO_PATH =
  'M15.14 29.56 H23.84 C26.16 29.56 25.58 19.7 22.39 19.7 C20.65 19.7 19.78 21.44 19.78 24.34 L19.78 36.52 ' +
  'C19.78 40 22.1 41.16 25 39.42 C27.9 37.1 29.64 33.04 31.38 30.72 C33.7 34.2 36.02 36.52 34.28 39.42 ' +
  'C33.12 41.16 29.64 40.58 29.06 38.84 C31.38 40.58 36.02 40 38.34 36.52 C40.66 31.88 44.14 23.76 42.4 21.44 ' +
  'C40.66 19.12 38.34 23.76 38.92 29.56 L38.92 40.58 L38.92 36.52 C39.5 34.2 41.82 30.72 45.3 31.3 ' +
  'C47.62 31.88 46.46 35.36 41.82 35.36 C44.14 35.94 45.3 40 48.78 40.58 C53.8 40.6 55.7 45.9 57.4 41.2 ' +
  'A27 27 0 1 0 51.1 51.1';

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

export function Logo({ size = 32, withWordmark = false }: LogoProps) {
  const gradientId = useId();
  // A tamaños pequeños el trazo se engrosa para seguir siendo legible.
  const strokeWidth = size <= 24 ? 4.6 : size <= 40 ? 3.8 : 2.8;

  const mark = (
    <svg width={size} height={size} viewBox="0 0 64 64" overflow="visible" aria-hidden={withWordmark} role="img">
      {!withWordmark && <title>Tasky</title>}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDBA74" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d={LOGO_PATH}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!withWordmark) return mark;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {mark}
      <span style={{ fontWeight: 650, fontSize: size * 0.62, letterSpacing: '-0.03em' }}>tasky</span>
    </span>
  );
}
