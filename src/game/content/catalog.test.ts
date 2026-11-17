import { describe, expect, it } from 'vitest';
import { evolutionEntries, passiveChanges, passiveEntries, recipeText, weaponEntries } from './catalog';
import { EVOLUTIONS } from './evolutions';
import { PASSIVE_BY_ID, PASSIVES } from './passives';
import { TUNA_FORMS, WEAPON_BY_ID, WEAPONS } from './weapons';

describe('catálogo', () => {
  it('incluye todas las armas, pasivas y evoluciones definidas en el juego', () => {
    expect(weaponEntries().map((w) => w.def.id)).toEqual([...WEAPONS, ...TUNA_FORMS.slice(1)].map((w) => w.id));
    expect(passiveEntries().map((p) => p.def.id)).toEqual(PASSIVES.map((p) => p.id));
    expect(evolutionEntries().map((e) => e.evolution.def.id)).toEqual(EVOLUTIONS.map((e) => e.def.id));
  });

  it('cada arma declara su tipo de ataque y las evoluciones heredan el de su base', () => {
    for (const w of WEAPONS) expect(w.attack, w.name).toBeTruthy();
    for (const e of evolutionEntries()) expect(e.attack).toBe(WEAPON_BY_ID.get(e.weapon.id)!.attack);
  });

  it('muestra los valores reales del arma en el nivel 1 y en el máximo', () => {
    const spark = weaponEntries().find((w) => w.def.id === 'spark')!;
    expect(spark.maxLevel).toBe(8);
    expect(spark.first.damage).toBe('16');
    // 16 + 16 + 16 de los niveles 5 y 8.
    expect(spark.last.damage).toBe('48');
    expect(spark.levels).toHaveLength(7);
    expect(weaponEntries().find((w) => w.def.id === 'whip')!.first.pierce).toBe('Todos');
    expect(weaponEntries().find((w) => w.def.id === 'victory')!.maxLevel).toBe(12);
    expect(weaponEntries().find((w) => w.def.id === 'tuna3')!.maxLevel).toBe(6);
  });

  it('calcula los efectos de las pasivas aplicándolas de verdad', () => {
    expect(passiveChanges(PASSIVE_BY_ID.get('whetstone')!)).toEqual([{ stat: 'might', label: 'Daño', perLevel: '+10 %', atMax: '+50 %' }]);
    const hourglass = passiveChanges(PASSIVE_BY_ID.get('hourglass')!)[0];
    expect([hourglass.perLevel, hourglass.atMax]).toEqual(['−8 %', '−40 %']);
    const horn = passiveChanges(PASSIVE_BY_ID.get('horn')!)[0];
    expect([horn.perLevel, horn.atMax]).toEqual(['+1', '+2']);
    const tiramisu = passiveChanges(PASSIVE_BY_ID.get('tiramisu')!)[0];
    expect([tiramisu.stat, tiramisu.perLevel, tiramisu.atMax]).toEqual(['revival', '+1', '+2']);
    expect(passiveChanges(PASSIVE_BY_ID.get('oakheart')!).map((c) => c.stat)).toEqual(['maxHp']);
    for (const p of PASSIVES) expect(passiveChanges(p).length, p.name).toBeGreaterThan(0);
  });

  it('cada evolución indica su arma base y todo lo que pide su receta', () => {
    for (const e of evolutionEntries()) {
      expect(e.weapon.id).toBe(e.evolution.weapon);
      expect(e.ingredients.length, e.evolution.def.name).toBeGreaterThan(0);
    }
    const ids = (id: string) => evolutionEntries().find((e) => e.evolution.def.id === id)?.ingredients.map((i) => i.id);
    expect(ids('luckyblades')).toEqual(['scales']);
    expect(ids('eternal')).toEqual(['silverring', 'goldring']);
    expect(ids('spirit')).toEqual(['tiramisu']);
    expect(ids('galedance')).toEqual(['galewhip']);
    expect(recipeText(EVOLUTIONS.find((e) => e.def.id === 'galedance')!, 'vento')).toBe('Látigo de Sangre');
  });
});
