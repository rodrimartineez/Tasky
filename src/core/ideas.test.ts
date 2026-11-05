import { describe, expect, it } from 'vitest';
import { emptyData } from './data';
import { createIdea, deleteIdea, updateIdea } from './ideas';
import { createProject, deleteProject } from './projects';
import { projectIdeas } from './selectors';

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
