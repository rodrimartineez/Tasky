import { authorsOf, usePeople } from '../../state/people';
import { Avatar, AvatarStack } from './Avatar';

interface AuthorshipProps {
  record: { id: string; updatedAt: string };
  /** Proyecto al que pertenece (para saber si está compartido). */
  projectId?: string;
  /** Si es una idea general, su propio id. */
  ideaId?: string;
}

/** ¿Está el elemento compartido con alguien? */
export function useIsShared({ projectId, ideaId }: Pick<AuthorshipProps, 'projectId' | 'ideaId'>) {
  return usePeople(
    (s) => (projectId ? (s.shares.project[projectId]?.length ?? 0) > 1 : false) || (ideaId ? (s.shares.idea[ideaId]?.length ?? 0) > 1 : false),
  );
}

/** Avatar de quien creó el elemento y, si es otra persona, de quien lo modificó por última vez. Solo en lo compartido. */
export function Authorship({ record, projectId, ideaId }: AuthorshipProps) {
  const shared = useIsShared({ projectId, ideaId });
  const createdBy = usePeople((s) => authorsOf(s, record).createdBy);
  const updatedBy = usePeople((s) => authorsOf(s, record).updatedBy);
  if (!shared) return null;
  const ids = updatedBy && updatedBy !== createdBy ? [createdBy, updatedBy] : [createdBy];
  return <AvatarStack userIds={ids.filter((id): id is string => id !== null)} size={18} />;
}

/** Avatar y nombre de una persona (detalles). */
export function Person({ userId }: { userId: string | null }) {
  const name = usePeople((s) => (userId ? s.profiles[userId] : undefined));
  if (!userId || !name) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Avatar userId={userId} size={18} /> {name}
    </span>
  );
}
