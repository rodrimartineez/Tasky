import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { describeActivity } from '../../core/collab';
import { setSeenNow, unseenCount, usePeople } from '../../state/people';
import { markNotificationsSeen, useSync } from '../../state/sync';
import { Avatar } from './Avatar';
import styles from './Notifications.module.css';

const rel = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
function ago(iso: string) {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return 'ahora mismo';
  if (Math.abs(minutes) < 60) return rel.format(minutes, 'minute');
  if (Math.abs(minutes) < 60 * 24) return rel.format(Math.round(minutes / 60), 'hour');
  return rel.format(Math.round(minutes / 1440), 'day');
}

/** Campana con los avisos de lo compartido. Discreta: solo un contador; los avisos se marcan como vistos al abrirla. */
export function Notifications() {
  const signedIn = useSync((s) => s.userId !== null);
  const all = usePeople((s) => s.activity);
  const me = usePeople((s) => s.me);
  const activity = all.filter((a) => a.actorId !== me);
  const seenAt = usePeople((s) => s.seenAt);
  const unseen = usePeople(unseenCount);
  const names = usePeople((s) => s.profiles);
  const [open, setOpen] = useState(false);
  // Los avisos «nuevos» se resaltan hasta cerrar el panel, aunque ya se hayan marcado como vistos.
  const [freshSince, setFreshSince] = useState(seenAt);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!signedIn) return null;
  // Sin avisos nunca ha habido nada compartido: no ocupa sitio en la cabecera.
  if (activity.length === 0 && !open) return null;

  const toggle = () => {
    if (!open) {
      setFreshSince(seenAt);
      if (unseen > 0) {
        setSeenNow();
        void markNotificationsSeen().catch(() => undefined);
      }
    }
    setOpen(!open);
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unseen > 0 ? `Avisos: ${unseen} nuevos` : 'Avisos'}
        title="Avisos"
        onClick={toggle}
      >
        <Bell />
        {unseen > 0 && <span className={styles.badge}>{unseen > 9 ? '9+' : unseen}</span>}
      </button>
      {open && (
        <div className={styles.panel} role="region" aria-label="Avisos">
          <p className={styles.title}>Actividad compartida</p>
          {activity.length === 0 ? (
            <p className={styles.empty}>Sin novedades.</p>
          ) : (
            activity.map((a) => (
              <div key={a.id} className={`${styles.item} ${a.createdAt > freshSince ? styles.fresh : ''}`}>
                <Avatar userId={a.actorId} size={22} />
                <span>
                  {describeActivity(a, names[a.actorId] ?? 'Alguien')}
                  <span className={styles.when}>{ago(a.createdAt)}</span>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
