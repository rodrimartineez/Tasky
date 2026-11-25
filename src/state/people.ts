import { create } from 'zustand';
import type { ActivityItem, Authors, CollabSnapshot } from '../core/collab';

/** Personas y avisos de las cuentas compartidas. Solo vive en memoria: se descarga con cada sincronización. */
interface PeopleState {
  /** Id del usuario con la sesión iniciada. */
  me: string | null;
  profiles: Record<string, string>;
  shares: CollabSnapshot['shares'];
  owners: CollabSnapshot['owners'];
  isAdmin: boolean;
  activity: ActivityItem[];
  seenAt: string;
  authors: Authors;
}

const empty = (): PeopleState => ({
  me: null,
  profiles: {},
  shares: { project: {}, idea: {} },
  owners: {},
  isAdmin: false,
  activity: [],
  seenAt: new Date(0).toISOString(),
  authors: {},
});

export const usePeople = create<PeopleState>()(() => empty());

export const resetPeople = (me: string | null) => usePeople.setState({ ...empty(), me });
export const setCollab = (snapshot: CollabSnapshot) => usePeople.setState({ ...snapshot });
export const addAuthors = (authors: Authors) => usePeople.setState((s) => ({ authors: { ...s.authors, ...authors } }));
export const setSeenNow = () => usePeople.setState({ seenAt: new Date().toISOString() });

/**
 * Creador y último autor de un registro. Sin datos del servidor (registro nuevo o editado aquí y aún sin enviar)
 * el autor soy yo.
 */
export function authorsOf(s: PeopleState, record: { id: string; updatedAt: string }) {
  const known = s.authors[record.id];
  return {
    createdBy: known?.createdBy ?? s.me,
    updatedBy: known && known.version === record.updatedAt ? known.updatedBy : s.me,
  };
}

/** Avisos más nuevos que la última vez que se abrió el panel. */
export const unseenCount = (s: PeopleState) => s.activity.filter((a) => a.actorId !== s.me && a.createdAt > s.seenAt).length;
