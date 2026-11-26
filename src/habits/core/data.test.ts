import { describe, expect, it } from 'vitest';
import { emptyHabitsData, parseHabitsData } from './data';

const NOW = '2026-11-26T10:00:00.000Z';

describe('parseHabitsData', () => {
  it('un tipo de asiento desconocido pide actualizar en vez de dar los datos por dañados', () => {
    const raw = {
      ...emptyHabitsData(),
      ledger: [{ id: 'x', createdAt: NOW, updatedAt: NOW, deletedAt: null, kind: 'tipo_futuro', points: 0, gold: 0, detail: {} }],
    };
    expect(() => parseHabitsData(raw, NOW)).toThrow('versión más reciente');
  });

  it('datos con la forma incorrecta siguen considerándose dañados', () => {
    expect(() => parseHabitsData({ ...emptyHabitsData(), habits: 'no' }, NOW)).toThrow('dañados');
  });
});
