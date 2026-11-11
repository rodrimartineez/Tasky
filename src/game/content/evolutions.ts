import type { WeaponDef, WeaponStats } from '../sim/types';

/**
 * Evoluciones de armas (Fase 5c). Un arma al nivel máximo + la pasiva indicada (a cualquier nivel) se convierte,
 * al abrir el siguiente cofre, en su versión evolucionada: ocupa el mismo hueco, hereda el comportamiento del arma base
 * (`evolvedFrom`) y no tiene más niveles. Equilibrio: ~2× el daño de la base al nivel máximo (ver sim/builds.test.ts).
 * No importa de `weapons.ts` (que sí las importa a ellas) para evitar un ciclo.
 */
export interface EvolutionDef {
  /** Arma base que evoluciona. */
  weapon: string;
  /** Pasiva necesaria (a cualquier nivel). */
  passive: string;
  def: WeaponDef;
}

function evolution(
  weapon: string,
  passive: string,
  def: { id: string; name: string; description: string; proj?: string; color?: number; icon: string },
  base: WeaponStats,
): EvolutionDef {
  return { weapon, passive, def: { ...def, evolvedFrom: weapon, base, levels: [] } };
}

export const EVOLUTIONS: EvolutionDef[] = [
  evolution(
    'spark',
    'horn',
    { id: 'constellation', name: 'Constelación', description: 'Un abanico de estrellas que atraviesa a sus víctimas.', icon: 'x_constellation', proj: 'x_constellation' },
    { damage: 34, cooldown: 0.9, amount: 5, pierce: 4, area: 5, speed: 200, duration: 1.8, knockback: 40 },
  ),
  evolution(
    'lance',
    'whetstone',
    { id: 'dawnlance', name: 'Lanza del alba', description: 'Lanzas más anchas y letales que atraviesan toda la pantalla.', icon: 'x_dawnlance', proj: 'x_dawnlance' },
    { damage: 55, cooldown: 1.15, amount: 4, pierce: 999, area: 12, speed: 280, duration: 1.1, knockback: 80 },
  ),
  evolution(
    'orbs',
    'candle',
    { id: 'eclipse', name: 'Eclipse', description: 'Seis lunas oscuras que casi nunca dejan de girar.', icon: 'x_eclipse', proj: 'x_eclipse' },
    { damage: 20, cooldown: 2, amount: 6, pierce: 999, area: 48, speed: 3.8, duration: 7, knockback: 50 },
  ),
  evolution(
    'ember',
    'oakheart',
    { id: 'pyre', name: 'Pira del fénix', description: 'Un incendio enorme que arde alrededor de ti.', icon: 'w_pyre', color: 0xff4a3c },
    { damage: 17, cooldown: 0.4, amount: 1, pierce: 999, area: 76, speed: 0, duration: 0, knockback: 18 },
  ),
  evolution(
    'storm',
    'eye',
    { id: 'tempest', name: 'Tormenta perfecta', description: 'Rayos violetas que saltan sin fallar de un enemigo a otro.', icon: 'w_tempest', color: 0xe3b8ff },
    { damage: 44, cooldown: 1.7, amount: 3, pierce: 6, area: 150, speed: 0, duration: 0, knockback: 0 },
  ),
  evolution(
    'flask',
    'tome',
    { id: 'elixir', name: 'Elixir arcano', description: 'Frascos de alquimia mayor con una explosión devastadora.', icon: 'x_elixir', proj: 'x_elixir' },
    { damage: 66, cooldown: 2.3, amount: 4, pierce: 999, area: 52, speed: 0, duration: 0.7, knockback: 100 },
  ),
  evolution(
    'whip',
    'boots',
    { id: 'galewhip', name: 'Azote del viento', description: 'Cuatro latigazos de viento cortante.', icon: 'w_galewhip', proj: 'x_galewhip' },
    { damage: 64, cooldown: 0.8, amount: 4, pierce: 999, area: 84, speed: 0, duration: 0.18, knockback: 50 },
  ),
  evolution(
    'boomerang',
    'feather',
    { id: 'scythe', name: 'Guadaña espectral', description: 'Guadañas fantasma que van y vuelven sin descanso.', icon: 'w_scythe', proj: 'x_scythe' },
    { damage: 50, cooldown: 1.3, amount: 4, pierce: 999, area: 13, speed: 170, duration: 0.95, knockback: 30 },
  ),
  evolution(
    'mines',
    'lodestone',
    { id: 'magnetmines', name: 'Campo magnético', description: 'Minas más potentes y duraderas que se atraen unas a otras.', icon: 'x_magnetmines', proj: 'x_magnetmines' },
    { damage: 62, cooldown: 1.9, amount: 4, pierce: 999, area: 62, speed: 0, duration: 12, knockback: 80 },
  ),
  evolution(
    'beam',
    'lens',
    { id: 'prism', name: 'Prisma solar', description: 'Cuatro rayos amplios que giran durante más tiempo.', icon: 'w_prism', proj: 'x_prism' },
    { damage: 9, cooldown: 1, amount: 4, pierce: 999, area: 120, speed: 1.8, duration: 3.4, knockback: 8 },
  ),
  evolution(
    'meteors',
    'hourglass',
    { id: 'comets', name: 'Lluvia de cometas', description: 'Cometas helados que caen en oleadas sobre el campo de batalla.', icon: 'x_comets', proj: 'x_comets' },
    { damage: 90, cooldown: 2.9, amount: 5, pierce: 999, area: 72, speed: 0, duration: 0.7, knockback: 90 },
  ),
  evolution(
    'cloud',
    'fang',
    { id: 'plague', name: 'Peste carmesí', description: 'Nubes de sangre más grandes y duraderas.', icon: 'x_plague', proj: 'x_plague' },
    { damage: 24, cooldown: 2.4, amount: 4, pierce: 999, area: 64, speed: 0, duration: 7, knockback: 0 },
  ),
  evolution(
    'nova',
    'scales',
    { id: 'quake', name: 'Terremoto', description: 'Un seísmo que lanza lejos a todos los enemigos.', icon: 'w_quake', color: 0xffb347 },
    { damage: 90, cooldown: 1.9, amount: 1, pierce: 999, area: 140, speed: 0, duration: 0, knockback: 200 },
  ),
  evolution(
    'ricochet',
    'clover',
    { id: 'luckyblades', name: 'Filos de la fortuna', description: 'Cuchillas doradas que rebotan una y otra vez.', icon: 'x_luckyblades', proj: 'x_luckyblades' },
    { damage: 33, cooldown: 1.2, amount: 4, pierce: 7, area: 5, speed: 220, duration: 3, knockback: 25 },
  ),
  evolution(
    'drone',
    'hourglass',
    { id: 'gunship', name: 'Dron de asalto', description: 'Cuatro drones artilleros que disparan sin descanso.', icon: 'x_gunship', proj: 'x_gunship' },
    { damage: 34, cooldown: 1, amount: 4, pierce: 1, area: 38, speed: 2.8, duration: 10, knockback: 20 },
  ),
  evolution(
    'trail',
    'boots',
    { id: 'inferno', name: 'Senda infernal', description: 'Llamas azules enormes que tardan en apagarse.', icon: 'x_inferno', proj: 'x_inferno' },
    { damage: 22, cooldown: 0.2, amount: 3, pierce: 999, area: 30, speed: 0, duration: 3.6, knockback: 0 },
  ),
];

export const EVOLUTION_BY_WEAPON = new Map(EVOLUTIONS.map((e) => [e.weapon, e]));
