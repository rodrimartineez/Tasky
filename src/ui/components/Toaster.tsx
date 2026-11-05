import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import styles from './Toaster.module.css';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));
let nextId = 0;

/** Aviso breve no bloqueante (desaparece solo). */
export function toast(message: string, tone: Toast['tone'] = 'success') {
  const id = nextId++;
  useToasts.setState((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
  setTimeout(() => useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'error' ? 6000 : 4000);
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className={styles.region} role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={`${styles.toast} ${styles[t.tone]}`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {t.tone === 'success' ? <CircleCheck /> : <TriangleAlert />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
