import type { WeaponDef, WeaponStats } from '../sim/types';

/**
 * Evoluciones de armas (Fase 5c; recetas del género desde el 17/11/2026). Un arma al nivel máximo más lo que pida su
 * receta se convierte, al abrir el siguiente cofre, en su versión evolucionada: ocupa el mismo hueco, hereda el
 * comportamiento del arma base (`evolvedFrom`, salvo que sim/weapons.ts tenga uno propio con su id) y no tiene más niveles.
 * Recetas:
 * - `passives`: pasivas necesarias (a cualquier nivel; algunas piden dos).
 * - `union`: segunda arma, también al nivel máximo, que se fusiona con la primera (libera su hueco).
 * - `needs`: arma que hay que llevar (cualquier nivel, también una evolución); no se consume.
 * Equilibrio: ~2× el daño de la base al nivel máximo (ver sim/builds.test.ts).
 * No importa de `weapons.ts` (que sí las importa a ellas) para evitar un ciclo.
 */
export interface EvolutionDef {
  /** Arma base que evoluciona. */
  weapon: string;
  /** Pasivas necesarias (a cualquier nivel). */
  passives: string[];
  /** Arma que se fusiona con la base (las dos al nivel máximo). */
  union?: string;
  /** Arma que hay que llevar sin consumirla. */
  needs?: string;
  def: WeaponDef;
}

type Recipe = { passives?: string[]; union?: string; needs?: string };

function evolution(
  weapon: string,
  recipe: string | Recipe,
  def: { id: string; name: string; description: string; proj?: string; color?: number; icon: string },
  base: WeaponStats,
): EvolutionDef {
  const r: Recipe = typeof recipe === 'string' ? { passives: [recipe] } : recipe;
  return {
    weapon,
    passives: r.passives ?? [],
    ...(r.union ? { union: r.union } : {}),
    ...(r.needs ? { needs: r.needs } : {}),
    def: { ...def, evolvedFrom: weapon, base, levels: [] },
  };
}

export const EVOLUTIONS: EvolutionDef[] = [
  // ── Recetas del género: arma + pasiva ─────────────────────────────────────────────────────────
  evolution(
    'whip',
    'oakheart',
    { id: 'galewhip', name: 'Azote del viento', description: 'Latigazos de viento cortante que te curan con cada golpe.', icon: 'w_galewhip', proj: 'x_galewhip' },
    { damage: 64, cooldown: 0.8, amount: 4, pierce: 999, area: 84, speed: 0, duration: 0.18, knockback: 50 },
  ),
  evolution(
    'spark',
    'hourglass',
    { id: 'constellation', name: 'Constelación', description: 'Un chorro de estrellas sin apenas pausa entre disparos.', icon: 'w_constellation', proj: 'x_constellation' },
    { damage: 30, cooldown: 0.3, amount: 3, pierce: 3, area: 5, speed: 230, duration: 1.6, knockback: 25 },
  ),
  evolution(
    'lance',
    'feather',
    { id: 'dawnlance', name: 'Lanza del alba', description: 'Una ráfaga continua de lanzas que atraviesan toda la pantalla.', icon: 'w_dawnlance', proj: 'x_dawnlance' },
    { damage: 30, cooldown: 0.3, amount: 2, pierce: 999, area: 9, speed: 300, duration: 1.1, knockback: 40 },
  ),
  evolution(
    'axe',
    'lens',
    { id: 'deathspiral', name: 'Espiral de segures', description: 'Segures que giran hacia fuera en todas direcciones y lo atraviesan todo.', icon: 'w_deathspiral', proj: 'x_deathspiral' },
    { damage: 18, cooldown: 1.8, amount: 6, pierce: 999, area: 11, speed: 120, duration: 1.8, knockback: 30 },
  ),
  evolution(
    'boomerang',
    'clover',
    { id: 'scythe', name: 'Guadaña espectral', description: 'Guadañas fantasma que van y vuelven sin descanso.', icon: 'w_scythe', proj: 'x_scythe' },
    { damage: 50, cooldown: 1.3, amount: 4, pierce: 999, area: 13, speed: 170, duration: 0.95, knockback: 30 },
  ),
  evolution(
    'orbs',
    'candle',
    { id: 'eclipse', name: 'Eclipse', description: 'Seis lunas oscuras que no dejan de girar.', icon: 'w_eclipse', proj: 'x_eclipse' },
    { damage: 18, cooldown: 0.15, amount: 6, pierce: 999, area: 48, speed: 3.8, duration: 9, knockback: 50 },
  ),
  evolution(
    'firewand',
    'whetstone',
    { id: 'hellfire', name: 'Cetro del averno', description: 'Bolas de fuego enormes que atraviesan a varios enemigos.', icon: 'w_hellfire', proj: 'x_hellfire' },
    { damage: 40, cooldown: 2.2, amount: 4, pierce: 3, area: 14, speed: 110, duration: 2.6, knockback: 60 },
  ),
  evolution(
    'ember',
    'herb',
    { id: 'pyre', name: 'Pira del fénix', description: 'Un incendio enorme a tu alrededor que te cura al quemar.', icon: 'w_pyre', color: 0xff4a3c },
    { damage: 15, cooldown: 0.4, amount: 1, pierce: 999, area: 76, speed: 0, duration: 0, knockback: 18 },
  ),
  evolution(
    'cloud',
    'lodestone',
    { id: 'plague', name: 'Peste carmesí', description: 'Nubes de sangre que crecen y te siguen allá donde vas.', icon: 'w_plague', proj: 'x_plague' },
    { damage: 28, cooldown: 2.4, amount: 4, pierce: 999, area: 80, speed: 0, duration: 7, knockback: 0 },
  ),
  evolution(
    'ricochet',
    'scales',
    { id: 'luckyblades', name: 'Filos detonantes', description: 'Cuchillas doradas que estallan cada vez que rebotan.', icon: 'w_luckyblades', proj: 'x_luckyblades' },
    { damage: 20, cooldown: 1.2, amount: 4, pierce: 7, area: 5, speed: 220, duration: 3, knockback: 25 },
  ),
  evolution(
    'storm',
    'horn',
    { id: 'tempest', name: 'Tormenta perfecta', description: 'Cada rayo cae dos veces sobre sus víctimas.', icon: 'w_tempest', color: 0xe3b8ff },
    { damage: 30, cooldown: 1.7, amount: 3, pierce: 5, area: 150, speed: 0, duration: 0, knockback: 0 },
  ),
  evolution(
    'pentagram',
    'tome',
    { id: 'fullmoon', name: 'Sello de la luna llena', description: 'Borra a los enemigos de la pantalla y te entrega toda su experiencia.', icon: 'w_fullmoon', color: 0xfff2b0 },
    { damage: 100, cooldown: 20, amount: 1, pierce: 999, area: 220, speed: 0, duration: 0, knockback: 0 },
  ),
  evolution(
    'cats',
    'mask',
    { id: 'hunger', name: 'Hambre dorada', description: 'Gatos dorados que congelan a sus presas y a veces las convierten en oro.', icon: 'w_hunger', proj: 'x_hunger' },
    { damage: 42, cooldown: 2.4, amount: 4, pierce: 0, area: 13, speed: 50, duration: 9, knockback: 25 },
  ),
  evolution(
    'mana',
    'skull',
    { id: 'cataract', name: 'Columna del juicio', description: 'Columnas de luz enormes que además ralentizan a los enemigos.', icon: 'w_cataract', proj: 'x_cataract' },
    { damage: 60, cooldown: 2, amount: 3, pierce: 0, area: 36, speed: 0, duration: 2.5, knockback: 0 },
  ),
  evolution(
    'trail',
    'boots',
    { id: 'inferno', name: 'Senda infernal', description: 'Llamas azules enormes que tardan en apagarse.', icon: 'w_inferno', proj: 'x_inferno' },
    { damage: 36, cooldown: 0.2, amount: 4, pierce: 999, area: 52, speed: 0, duration: 3.6, knockback: 0 },
  ),
  // ── Recetas de dos pasivas ────────────────────────────────────────────────────────────────────
  evolution(
    'clock',
    { passives: ['silverring', 'goldring'] },
    { id: 'eternal', name: 'Instante eterno', description: 'Saetas de hielo que congelan y parten por la mitad la vida de lo que tocan.', icon: 'w_eternal', proj: 'x_eternal' },
    { damage: 15, cooldown: 1, amount: 3, pierce: 999, area: 8, speed: 220, duration: 1.4, knockback: 0 },
  ),
  evolution(
    'laurel',
    { passives: ['medalleft', 'medalright'] },
    { id: 'thornmail', name: 'Coraza de espinas', description: 'Ningún golpe te quita más de 10 de vida y cada uno devuelve el daño a tu alrededor.', icon: 'w_thornmail', color: 0xff5a6a },
    { damage: 40, cooldown: 5, amount: 1, pierce: 999, area: 70, speed: 0, duration: 2.5, knockback: 90 },
  ),
  // ── Fusiones de dos armas ─────────────────────────────────────────────────────────────────────
  evolution(
    'dove',
    { union: 'raven' },
    { id: 'twinwings', name: 'Alas del equilibrio', description: 'Las dos aves, unidas, bombardean sin parar a tu alrededor.', icon: 'w_twinwings', proj: 'x_twinwings' },
    { damage: 20, cooldown: 0.5, amount: 2, pierce: 0, area: 64, speed: 3, duration: 12, knockback: 25 },
  ),
  evolution(
    'cardinal',
    { union: 'saltire', passives: ['tiramisu'] },
    { id: 'starburst', name: 'Rosa de los vientos', description: 'Cuatro rayos larguísimos que giran a tu alrededor barriendo la pantalla.', icon: 'w_starburst', proj: 'x_starburst' },
    { damage: 2, cooldown: 1, amount: 4, pierce: 999, area: 110, speed: 1.1, duration: 2.6, knockback: 6 },
  ),
  // ── Evolución que pide otra evolución ─────────────────────────────────────────────────────────
  evolution(
    'vento',
    { needs: 'galewhip' },
    { id: 'galedance', name: 'Danza del vendaval', description: 'Cortes de viento por delante, por detrás y a un lado mientras corres.', icon: 'w_galedance', proj: 'x_galedance' },
    { damage: 30, cooldown: 0.35, amount: 3, pierce: 999, area: 70, speed: 0, duration: 0.2, knockback: 30 },
  ),
  // ── Armas propias de Tasky ────────────────────────────────────────────────────────────────────
  evolution(
    'flask',
    'tome',
    { id: 'elixir', name: 'Elixir arcano', description: 'Frascos de alquimia mayor con una explosión devastadora.', icon: 'w_elixir', proj: 'x_elixir' },
    { damage: 66, cooldown: 2.3, amount: 4, pierce: 999, area: 52, speed: 0, duration: 0.7, knockback: 100 },
  ),
  evolution(
    'mines',
    'fang',
    { id: 'magnetmines', name: 'Campo magnético', description: 'Minas más potentes y duraderas que se atraen unas a otras.', icon: 'w_magnetmines', proj: 'x_magnetmines' },
    { damage: 70, cooldown: 1.9, amount: 4, pierce: 999, area: 62, speed: 0, duration: 12, knockback: 80 },
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
    { id: 'comets', name: 'Lluvia de cometas', description: 'Cometas helados que caen en oleadas sobre el campo de batalla.', icon: 'w_comets', proj: 'x_comets' },
    { damage: 90, cooldown: 2.9, amount: 5, pierce: 999, area: 72, speed: 0, duration: 0.7, knockback: 90 },
  ),
  evolution(
    'nova',
    'puzzlebox',
    { id: 'quake', name: 'Terremoto', description: 'Un seísmo que lanza lejos a todos los enemigos.', icon: 'w_quake', color: 0xffb347 },
    { damage: 90, cooldown: 1.9, amount: 1, pierce: 999, area: 140, speed: 0, duration: 0, knockback: 200 },
  ),
  evolution(
    'drone',
    'eye',
    { id: 'gunship', name: 'Dron de asalto', description: 'Cuatro drones artilleros que disparan sin descanso.', icon: 'w_gunship', proj: 'x_gunship' },
    { damage: 34, cooldown: 1, amount: 4, pierce: 1, area: 38, speed: 2.8, duration: 10, knockback: 20 },
  ),
];

/** Evolución de cada arma (también de la segunda arma de una fusión). */
export const EVOLUTION_BY_WEAPON = new Map<string, EvolutionDef>(
  EVOLUTIONS.flatMap((e) => (e.union ? [[e.weapon, e] as const, [e.union, e] as const] : [[e.weapon, e] as const])),
);

/** Lo que pide una evolución además del arma base al máximo: armas (fusión o requisito) y pasivas. */
export function ingredientsOf(e: EvolutionDef): { kind: 'passive' | 'weapon'; id: string }[] {
  return [
    ...(e.union ? [{ kind: 'weapon' as const, id: e.union }] : []),
    ...(e.needs ? [{ kind: 'weapon' as const, id: e.needs }] : []),
    ...e.passives.map((id) => ({ kind: 'passive' as const, id })),
  ];
}
