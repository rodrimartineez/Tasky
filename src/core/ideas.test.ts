import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import {
  createIdea,
  createIdeaGroup,
  deleteIdea,
  deleteIdeaGroup,
  GENERAL_IDEAS_ID,
  setIdeaGroup,
  updateIdea,
  updateIdeaGroup,
} from './ideas';
import { createProject, deleteProject } from './projects';
import { groupIdeas, ideaGroups, projectIdeas } from './selectors';
import { mergeRemote, noRecords } from './sync';

const T0 = '2026-11-05T10:00:00.000Z';
const T1 = '2026-11-05T11:00:00.000Z';
const T2 = '2026-11-05T12:00:00.000Z';

const setup = () => {
  let d = createProject(emptyData(), { name: 'P', description: '' }, 'p', T0);
  d = createIdea(d, 'p', { title: ' Modo oscuro ', description: ' x ' }, 'i1', T0);
  return createIdea(d, 'p', { title: 'Widgets', description: '' }, 'i2', T1);
};

describe('ideas', () => {
  it('se crean con texto recortado y se listan de la más reciente a la más antigua', () => {
    const d = setup();
    expect(projectIdeas(d, 'p').map((i) => i.title)).toEqual(['Widgets', 'Modo oscuro']);
    expect(d.ideas[0].description).toBe('x');
    expect(() => createIdea(d, 'p', { title: '  ', description: '' }, 'i3', T0)).toThrow();
  });

  it('editar solo toca updatedAt si cambia algo', () => {
    let d = updateIdea(setup(), 'i1', { title: 'Modo oscuro', description: 'x' }, T2);
    expect(d.ideas[0].updatedAt).toBe(T0);
    d = updateIdea(d, 'i1', { title: 'Tema oscuro', description: '' }, T2);
    expect(d.ideas[0]).toMatchObject({ title: 'Tema oscuro', description: '', updatedAt: T2, createdAt: T0 });
  });

  it('se borran lógicamente, también en cascada con su proyecto', () => {
    expect(projectIdeas(deleteIdea(setup(), 'i1', T2), 'p').map((i) => i.id)).toEqual(['i2']);
    expect(projectIdeas(deleteProject(setup(), 'p', T2), 'p')).toEqual([]);
  });
});

describe('grupos de ideas generales', () => {
  const G = GENERAL_IDEAS_ID;
  const withGroups = () => {
    let d = createIdeaGroup(emptyData(), { name: ' Viajes ', description: '' }, 'g1', T0);
    d = createIdeaGroup(d, { name: 'Libros', description: '' }, 'g2', T0);
    d = createIdea(d, G, { title: 'Japón', description: '' }, 'a', T0, 'g1');
    return createIdea(d, G, { title: 'Suelta', description: '' }, 'b', T1);
  };

  it('los grupos nuevos van al final y cada idea se ve en su grupo o suelta', () => {
    const d = withGroups();
    expect(ideaGroups(d).map((g) => g.name)).toEqual(['Viajes', 'Libros']);
    expect(groupIdeas(d, 'g1').map((i) => i.id)).toEqual(['a']);
    expect(groupIdeas(d, null).map((i) => i.id)).toEqual(['b']);
    expect(groupIdeas(d, 'g2')).toEqual([]);
  });

  it('una idea de proyecto o con un grupo inexistente se crea sin grupo', () => {
    let d = createProject(withGroups(), { name: 'P', description: '' }, 'p', T0);
    d = createIdea(d, 'p', { title: 'X', description: '' }, 'c', T1, 'g1');
    d = createIdea(d, G, { title: 'Y', description: '' }, 'e', T1, 'nope');
    expect(d.ideas.find((i) => i.id === 'c')?.groupId).toBeNull();
    expect(d.ideas.find((i) => i.id === 'e')?.groupId).toBeNull();
  });

  it('mover una idea de grupo y editar el grupo solo cambia updatedAt si hay cambios', () => {
    let d = setIdeaGroup(withGroups(), 'b', 'g2', T2);
    expect(groupIdeas(d, 'g2').map((i) => i.id)).toEqual(['b']);
    expect(setIdeaGroup(d, 'b', 'g2', T2)).toEqual(d);
    expect(() => setIdeaGroup(d, 'b', 'nope', T2)).toThrow('no existe');
    expect(updateIdeaGroup(d, 'g1', { name: 'Viajes', description: '' }, T2)).toEqual(d);
    d = updateIdeaGroup(d, 'g1', { name: 'Escapadas', description: '' }, T2);
    expect(ideaGroups(d)[0]).toMatchObject({ name: 'Escapadas', updatedAt: T2 });
    expect(() => updateIdeaGroup(d, 'g1', { name: ' ', description: '' }, T2)).toThrow('obligatorio');
  });

  it('borrar un grupo deja sus ideas sueltas', () => {
    const d = deleteIdeaGroup(withGroups(), 'g1', T2);
    expect(ideaGroups(d).map((g) => g.id)).toEqual(['g2']);
    expect(d.ideas.find((i) => i.id === 'a')).toMatchObject({ groupId: null, deletedAt: null, updatedAt: T2 });
  });

  it('una idea cuyo grupo se borró en otro dispositivo se ve suelta', () => {
    const d = withGroups();
    const remote = { ...noRecords(), ideaGroups: [{ ...d.ideaGroups[0], deletedAt: T2, updatedAt: T2 }] };
    const merged = mergeRemote(d, remote, T2);
    expect(
      groupIdeas(merged, null)
        .map((i) => i.id)
        .sort(),
    ).toEqual(['a', 'b']);
  });
});
