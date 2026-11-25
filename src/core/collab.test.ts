import { describe, expect, it } from 'vitest';
import { lostAccess, type ActivityItem } from './collab';
import { emptyData } from './data';
import { purgeRecords } from './sync';

const event = (id: number, kind: ActivityItem['kind'], projectId: string | null, ideaId: string | null, target = 'me'): ActivityItem => ({
  id,
  actorId: 'ana',
  kind,
  subject: 'X',
  context: '',
  projectId,
  ideaId,
  targetUserId: target,
  createdAt: '2026-11-25T10:00:00.000Z',
});

describe('lostAccess', () => {
  it('pierde el acceso si el último aviso dirigido a mí es «dejar de compartir»', () => {
    const lost = lostAccess(
      [
        event(3, 'project_unshared', 'p1', null),
        event(1, 'project_shared', 'p1', null),
        event(2, 'idea_unshared', null, 'i1'),
        event(4, 'project_unshared', 'p2', null, 'otra'),
      ],
      'me',
    );
    expect([...lost.projects]).toEqual(['p1']);
    expect([...lost.ideas]).toEqual(['i1']);
  });

  it('conserva lo que se volvió a compartir después', () => {
    const lost = lostAccess([event(5, 'project_shared', 'p1', null), event(3, 'project_unshared', 'p1', null)], 'me');
    expect(lost.projects.size).toBe(0);
  });
});

describe('purgeRecords', () => {
  const t = '2026-11-25T10:00:00.000Z';
  const base = { createdAt: t, updatedAt: t, deletedAt: null };
  const data = {
    ...emptyData(),
    projects: [
      { ...base, id: 'p1', name: 'A', description: '', status: 'active' as const, rank: null },
      { ...base, id: 'p2', name: 'B', description: '', status: 'active' as const, rank: null },
    ],
    ideas: [
      { ...base, id: 'i1', projectId: 'p1', title: 'x', description: '' },
      { ...base, id: 'i2', projectId: 'g', title: 'y', description: '' },
    ],
  };

  it('quita el proyecto con sus ideas y las ideas indicadas, sin lápidas', () => {
    const out = purgeRecords(data, new Set(['p1']), new Set(['i2']));
    expect(out.projects.map((p) => p.id)).toEqual(['p2']);
    expect(out.ideas).toEqual([]);
  });

  it('devuelve los mismos datos si no hay nada que quitar', () => {
    expect(purgeRecords(data, new Set(['nada']), new Set())).toBe(data);
  });
});
