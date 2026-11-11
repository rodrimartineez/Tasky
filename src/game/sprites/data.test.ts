import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../content/enemies';
import { PASSIVES } from '../content/passives';
import { WITHERED_WOODS } from '../content/stages';
import { WEAPONS } from '../content/weapons';
import { PALETTE, SPRITES } from './data';

describe('sprites', () => {
  it('son rectangulares y solo usan colores de la paleta', () => {
    for (const [name, rows] of Object.entries(SPRITES)) {
      for (const row of rows) {
        expect(row.length, `${name}: «${row}»`).toBe(rows[0].length);
        for (const ch of row) expect(ch === '.' || ch in PALETTE, `${name}: «${ch}»`).toBe(true);
      }
    }
  });

  it('existen todos los sprites que usa el contenido', () => {
    const used = [
      ...ENEMIES.map((e) => e.sprite),
      ...WEAPONS.map((w) => w.icon),
      ...PASSIVES.map((p) => p.icon),
      ...WITHERED_WOODS.props,
      ...['x_spark', 'x_lance', 'x_orb', 'x_flask', 'x_thorn', 'hero_0', 'hero_1'],
      ...['i_xp1', 'i_xp2', 'i_xp3', 'i_coin', 'i_heart', 'i_chest', 'i_magnet'],
    ];
    for (const name of used) expect(SPRITES[name], name).toBeDefined();
  });
});
