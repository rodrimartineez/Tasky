import { describe, expect, it } from 'vitest';
import { evolutionEntries, passiveChanges, passiveEntries, weaponEntries } from './catalog';
import { EVOLUTIONS } from './evolutions';
import { PASSIVE_BY_ID, PASSIVES } from './passives';
import { WEAPON_BY_ID, WEAPONS } from './weapons';

describe('catálogo', () => {
  it('incluye todas las armas, pasivas y evoluciones definidas en el juego', () => {
    expect(weaponEntries().map((w) => w.def.id)).toEqual(WEAPONS.map((w) => w.id));
    expect(passiveEntries().map((p) => p.def.id)).toEqual(PASSIVES.map((p) => p.id));
    expect(evolutionEntries().map((e) => e.evolution.def.id)).toEqual(EVOLUTIONS.map((e) => e.def.id));
  });

  it('cada arma declara su tipo de ataque y las evoluciones heredan el de su base', () => {
    for (const w of WEAPONS) expect(w.attack, w.name).toBeTruthy();
    for (const e of evolutionEntries()) expect(e.attack).toBe(WEAPON_BY_ID.get(e.weapon.id)!.attack);
  });

  it('muestra los valores reales del arma en el nivel 1 y en el máximo', () => {
    const spark = weaponEntries().find((w) => w.def.id === 'spark')!;
    expect(spark.maxLevel).toBe(7);
    expect(spark.first.damage).toBe('10');
    // 10 + 11 + 8 + 8 de los niveles 3, 5 y 7.
    expect(spark.last.damage).toBe('37');
    expect(spark.levels).toHaveLength(6);
    expect(weaponEntries().find((w) => w.def.id === 'lance')!.first.pierce).toBe('Todos');
  });

  it('calcula los efectos de las pasivas aplicándolas de verdad', () => {
    expect(passiveChanges(PASSIVE_BY_ID.get('whetstone')!)).toEqual([{ stat: 'might', label: 'Daño', perLevel: '+10 %', atMax: '+85 %' }]);
    const hourglass = passiveChanges(PASSIVE_BY_ID.get('hourglass')!)[0];
    expect([hourglass.perLevel, hourglass.atMax]).toEqual(['−6 %', '−48 %']);
    const horn = passiveChanges(PASSIVE_BY_ID.get('horn')!)[0];
    expect([horn.perLevel, horn.atMax]).toEqual(['+1', '+2']);
    expect(passiveChanges(PASSIVE_BY_ID.get('oakheart')!).map((c) => c.stat)).toEqual(['maxHp', 'regen']);
    for (const p of PASSIVES) expect(passiveChanges(p).length, p.name).toBeGreaterThan(0);
  });

  it('cada evolución indica su arma base y la pasiva que necesita', () => {
    for (const e of evolutionEntries()) {
      expect(e.weapon.id).toBe(e.evolution.weapon);
      expect(e.passive.id).toBe(e.evolution.passive);
    }
  });
});
