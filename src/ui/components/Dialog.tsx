import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useOverlay } from '../shortcuts/overlays';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE = 'input, textarea, button, select, a[href], [tabindex]:not([tabindex="-1"])';
const isSheet = () => window.matchMedia('(max-width: 640px)').matches;
const openStack: (() => void)[] = [];

/** Diálogo modal. En pantallas estrechas se presenta como hoja inferior. */
export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  useOverlay(open);
  return createPortal(
    <AnimatePresence>
      {open && (
        <DialogPanel onClose={onClose} title={title} description={description} footer={footer}>
          {children}
        </DialogPanel>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DialogPanel({ onClose, title, description, children, footer }: Omit<DialogProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const sheet = isSheet();

  // Foco inicial en el elemento marcado (o el primero enfocable, o el propio panel) y devolución del foco al cerrar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target?.focus();
    return () => previous?.focus?.();
  }, []);

  // Esc cierra solo el diálogo superior, esté donde esté el foco.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const close = () => closeRef.current();
    openStack.push(close);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || openStack[openStack.length - 1] !== close) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      openStack.splice(openStack.indexOf(close), 1);
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    // Mantiene el foco dentro del diálogo.
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={styles.root} onKeyDown={onKeyDown}>
      <motion.div
        className={styles.backdrop}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={titleId}
        className={`${styles.panel} ${sheet ? styles.sheet : ''}`}
        initial={sheet ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 6 }}
        animate={sheet ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={sheet ? { y: '100%' } : { opacity: 0, scale: 0.98, y: 4 }}
        transition={{ duration: sheet ? 0.24 : 0.16, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description && <div className={styles.description}>{description}</div>}
        </header>
        {children && <div className={styles.body}>{children}</div>}
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </motion.div>
    </div>
  );
}
