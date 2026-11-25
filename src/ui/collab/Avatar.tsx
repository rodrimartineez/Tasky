import type { CSSProperties } from 'react';
import { usePeople } from '../../state/people';
import styles from './Avatar.module.css';

/** Color estable por usuario (el mismo nombre siempre da el mismo tono). */
const hueOf = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** Círculo con la inicial del nombre de usuario. Sin nombre conocido no se dibuja nada. */
export function Avatar({ userId, size = 20 }: { userId: string | null; size?: number }) {
  const name = usePeople((s) => (userId ? s.profiles[userId] : undefined));
  if (!name) return null;
  return (
    <span
      className={styles.avatar}
      style={{ '--size': `${size}px`, '--hue': hueOf(name) } as CSSProperties}
      title={name}
      role="img"
      aria-label={name}
    >
      {name[0]}
    </span>
  );
}

/** Varios avatares solapados (participantes de un proyecto o idea compartidos). */
export function AvatarStack({ userIds, size = 20 }: { userIds: string[]; size?: number }) {
  return (
    <span className={styles.stack} style={{ '--size': `${size}px` } as CSSProperties}>
      {userIds.map((id) => (
        <Avatar key={id} userId={id} size={size} />
      ))}
    </span>
  );
}
