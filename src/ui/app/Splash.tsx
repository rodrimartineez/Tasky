import { motion } from 'motion/react';
import { LOGO_PATH } from '../components/Logo';

/** Entrada breve (~0,7 s): el sello se dibuja de un solo trazo y la pantalla se desvanece. La app ya está cargada debajo. */
export function Splash({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
        pointerEvents: 'none',
      }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <svg width="96" height="96" viewBox="0 0 64 64" overflow="visible">
        <defs>
          <linearGradient id="splash-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FDBA74" />
            <stop offset="1" stopColor="#EA580C" />
          </linearGradient>
        </defs>
        <motion.path
          d={LOGO_PATH}
          fill="none"
          stroke="url(#splash-gradient)"
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ pathLength: { duration: 0.5, ease: [0.6, 0, 0.2, 1] }, opacity: { duration: 0.05 } }}
          onAnimationComplete={onDone}
        />
      </svg>
    </motion.div>
  );
}
