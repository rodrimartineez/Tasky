import { describe, expect, it } from 'vitest';
import { DataError, emptyData, parseData } from './data';
import { createProject, deleteProject } from './projects';

const NOW = '2026-11-05T10:00:00.000Z';

describe('parseData', () => {
  it('devuelve datos vacíos si no hay nada guardado', () => {
    expect(parseData(null, NOW)).toEqual(emptyData());
  });

  it('acepta datos válidos (ida y vuelta por JSON)', () => {
    const data = createProject(emptyData(), { name: 'A', description: '' }, 'p1', NOW);
    expect(parseData(JSON.parse(JSON.stringify(data)), NOW)).toEqual(data);
  });

  it('rechaza datos dañados o de una versión futura', () => {
    expect(() => parseData({ foo: 1 }, NOW)).toThrow(DataError);
    expect(() => parseData({ schemaVersion: 1, projects: [{ id: 1 }], tasks: [], ideas: [] }, NOW)).toThrow(DataError);
    expect(() => parseData({ ...emptyData(), schemaVersion: 99 }, NOW)).toThrow(DataError);
  });

  it('purga lápidas de más de 30 días y conserva las recientes', () => {
    let data = createProject(emptyData(), { name: 'Viejo', description: '' }, 'old', NOW);
    data = createProject(data, { name: 'Reciente', description: '' }, 'new', NOW);
    data = deleteProject(data, 'old', '2026-09-01T00:00:00.000Z');
    data = deleteProject(data, 'new', '2026-11-01T00:00:00.000Z');
    expect(parseData(data, NOW).projects.map((p) => p.id)).toEqual(['new']);
  });
});
