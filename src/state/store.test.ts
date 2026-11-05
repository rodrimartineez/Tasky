import { describe, expect, it, vi } from 'vitest';
import type { TaskyData } from '../core/model';
import type { Storage } from '../core/ports';
import { useTasky } from './store';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('store + persistencia', () => {
  it('no guarda nunca si la carga falla (protege el archivo existente)', async () => {
    const save = vi.fn();
    await useTasky.getState().load({ load: async () => ({ basura: true }), save });
    expect(useTasky.getState().status).toBe('error');
    useTasky.getState().createProject({ name: 'X', description: '' });
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('carga, aplica cambios y guarda siempre la última versión', async () => {
    const saved: TaskyData[] = [];
    let release!: () => void;
    const storage: Storage = {
      load: async () => null,
      save: (d) => {
        saved.push(d);
        return new Promise<void>((r) => (release = r));
      },
    };
    await useTasky.getState().load(storage);
    const { createProject, updateProject } = useTasky.getState();

    const id = createProject({ name: 'A', description: '' }); // inicia la 1.ª escritura
    updateProject(id, { name: 'B' }); // se encola
    updateProject(id, { name: 'C' }); // sustituye a la encolada
    release();
    await flush();
    release();
    await flush();

    expect(saved.map((d) => d.projects[0].name)).toEqual(['A', 'C']);
    expect(useTasky.getState().saveError).toBeNull();
  });
});
