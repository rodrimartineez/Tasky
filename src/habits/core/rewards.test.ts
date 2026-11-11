import { describe, expect, it } from 'vitest';
import { nextMilestone, streakPoints } from './rewards';

describe('puntos por hitos de racha', () => {
  it('suma un punto en cada hito y uno más cada año', () => {
    const table = [1, 2, 3, 6, 7, 13, 14, 29, 30, 59, 60, 99, 100, 179, 180, 364, 365, 729, 730, 1095].map((s) => [s, streakPoints(s)]);
    expect(table).toEqual([
      [1, 1], [2, 1], [3, 2], [6, 2], [7, 3], [13, 3], [14, 4], [29, 4], [30, 5], [59, 5],
      [60, 6], [99, 6], [100, 7], [179, 7], [180, 8], [364, 8], [365, 9], [729, 9], [730, 10], [1095, 11],
    ]);
  });

  it('indica el siguiente hito', () => {
    expect(nextMilestone(1)).toEqual({ days: 3, points: 2 });
    expect(nextMilestone(30)).toEqual({ days: 60, points: 6 });
    expect(nextMilestone(400)).toEqual({ days: 730, points: 10 });
  });
});
