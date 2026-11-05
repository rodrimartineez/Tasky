import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
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
  // Cada apertura es una instancia nueva: reabrir mientras la anterior aún se anima al cerrarse
  // nunca reutiliza su contenido (p. ej. el texto de un formulario ya enviado).
  const [prevOpen, setPrevOpen] = useState(open);
  const [instance, setInstance] = useState(0);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setInstance((n) => n + 1);
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <DialogPanel key={instance} onClose={onClose} title={title} description={description} footer={footer}>
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

  // Mientras se anima su salida, el diálogo ya está cerrado a todos los efectos: inerte, sin Esc
  // y con el foco devuelto. Así una tecla pulsada justo después de cerrar nunca le llega.
  const isPresent = useIsPresent();

  // Foco inicial en el elemento marcado (o el primero enfocable, o el propio panel) y devolución del foco al cerrar.
  useEffect(() => {
    if (!isPresent) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target?.focus();
    return () => {
      // Primero se suelta el foco del diálogo (un campo inerte podría seguir recibiendo teclas)…
      if (panel?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      // …y después se devuelve a donde estaba, si sigue existiendo.
      if (previous?.isConnected && previous !== document.body) previous.focus();
    };
  }, [isPresent]);

  // Esc cierra solo el diálogo superior, esté donde esté el foco.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!isPresent) return;
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
  }, [isPresent]);

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
    <div className={styles.root} onKeyDown={onKeyDown} inert={!isPresent}>
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
