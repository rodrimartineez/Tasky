import type { WeaponDef, WeaponStats } from '../sim/types';

/**
 * Evoluciones de armas: las recetas de la referencia del género, sin inventar ninguna. Un arma al nivel máximo más lo
 * que pida su receta se convierte, al abrir el siguiente cofre, en su versión evolucionada: ocupa el mismo hueco,
 * hereda el comportamiento del arma base (`evolvedFrom`, salvo que sim/weapons.ts tenga uno propio con su id) y no
 * tiene más niveles. Recetas:
 * - `passives`: pasivas necesarias; a cualquier nivel salvo con `maxed`, que las pide al máximo.
 * - `union`: segunda arma (o evolución), también al máximo, que se fusiona con la primera (libera su hueco).
 * El Atún Cambiante evoluciona aparte (sin pasiva, eligiendo forma: sim/upgrades.ts).
 * No importa de `weapons.ts` (que sí las importa a ellas) para evitar un ciclo.
 */
export interface EvolutionDef {
  /** Arma base que evoluciona. */
  weapon: string;
  passives: string[];
  /** Las pasivas tienen que estar a su nivel máximo. */
  maxed?: boolean;
  /** Arma que se fusiona con la base (las dos al nivel máximo). */
  union?: string;
  def: WeaponDef;
}

type Recipe = { passives?: string[]; maxed?: boolean; union?: string };

const s = (stats: Partial<WeaponStats>): WeaponStats => ({ damage: 0, cooldown: 1, amount: 1, pierce: 999, area: 0, speed: 0, duration: 0, knockback: 0, ...stats });

function evolution(
  weapon: string,
  recipe: string | Recipe,
  def: Omit<WeaponDef, 'base' | 'levels' | 'evolvedFrom'>,
  base: Partial<WeaponStats>,
): EvolutionDef {
  const r: Recipe = typeof recipe === 'string' ? { passives: [recipe] } : recipe;
  return {
    weapon,
    passives: r.passives ?? [],
    ...(r.maxed ? { maxed: true } : {}),
    ...(r.union ? { union: r.union } : {}),
    def: { ...def, evolvedFrom: weapon, base: s(base), levels: [] },
  };
}

export const EVOLUTIONS: EvolutionDef[] = [
  evolution(
    'whip',
    'oakheart',
    { id: 'galewhip', name: 'Látigo de Sangre', description: 'Latigazos de sangre con críticos que te curan.', icon: 'w_galewhip', proj: 'x_galewhip', crit: 0.1 },
    { damage: 80, cooldown: 0.9, amount: 2, area: 100, duration: 0.25, knockback: 50 },
  ),
  evolution(
    'spark',
    'hourglass',
    { id: 'constellation', name: 'Varita Sagrada', description: 'Dispara sin pausa entre proyectiles.', icon: 'w_constellation', proj: 'x_constellation', interval: 0.1 },
    { damage: 60, cooldown: 0.15, pierce: 2, area: 5, speed: 230, duration: 1.6, knockback: 25 },
  ),
  evolution(
    'lance',
    'feather',
    { id: 'dawnlance', name: 'Mil Filos', description: 'Un chorro continuo de cuchillos hacia donde miras.', icon: 'w_dawnlance', proj: 'x_dawnlance', interval: 0.05 },
    { damage: 30, cooldown: 0.15, amount: 2, pierce: 3, area: 5, speed: 340, duration: 1, knockback: 20 },
  ),
  evolution(
    'axe',
    'lens',
    { id: 'deathspiral', name: 'Espiral Letal', description: 'Guadañas que salen en espiral en todas direcciones y lo atraviesan todo.', icon: 'w_deathspiral', proj: 'x_deathspiral' },
    { damage: 64, cooldown: 3, amount: 9, area: 11, speed: 120, duration: 2, knockback: 30 },
  ),
  evolution(
    'boomerang',
    'clover',
    { id: 'scythe', name: 'Espada Celestial', description: 'Espadas de luz que van y vuelven y asestan críticos.', icon: 'w_scythe', proj: 'x_scythe', interval: 0.1, crit: 0.15 },
    { damage: 90, cooldown: 1.1, amount: 3, area: 10, speed: 210, duration: 0.7, knockback: 30 },
  ),
  evolution(
    'orbs',
    'candle',
    { id: 'eclipse', name: 'Ritos Impíos', description: 'Los libros ya no dejan de girar nunca.', icon: 'w_eclipse', proj: 'x_eclipse' },
    { damage: 48, cooldown: 3, amount: 4, area: 51, speed: 5.1, duration: 4, knockback: 50 },
  ),
  evolution(
    'firewand',
    'whetstone',
    { id: 'hellfire', name: 'Fuego Infernal', description: 'Bolas de fuego enormes que lo atraviesan todo.', icon: 'w_hellfire', proj: 'x_hellfire' },
    { damage: 100, cooldown: 2.25, amount: 2, area: 14, speed: 90, duration: 3, knockback: 60 },
  ),
  evolution(
    'ember',
    'herb',
    { id: 'pyre', name: 'Engullealmas', description: 'Un aura enorme que te cura con cada golpe.', icon: 'w_pyre', color: 0x9b5cff },
    { damage: 36, cooldown: 0.7, area: 90, knockback: 18 },
  ),
  evolution(
    'cloud',
    'lodestone',
    { id: 'plague', name: 'Brebaje Santo', description: 'Charcos que crecen y te siguen allá donde vas.', icon: 'w_plague', proj: 'x_plague', interval: 0.3 },
    { damage: 400, cooldown: 5, amount: 4, area: 45, duration: 5 },
  ),
  evolution(
    'ricochet',
    'scales',
    { id: 'luckyblades', name: 'Sin Futuro', description: 'Runas que estallan cada vez que rebotan en un borde.', icon: 'w_luckyblades', proj: 'x_luckyblades' },
    { damage: 72, cooldown: 1.8, amount: 3, area: 7, speed: 270, duration: 3.5, knockback: 25 },
  ),
  evolution(
    'storm',
    'horn',
    { id: 'tempest', name: 'Tormenta Eléctrica', description: 'Cada rayo cae dos veces.', icon: 'w_tempest', color: 0xe3b8ff },
    { damage: 185, cooldown: 2.6, amount: 5, area: 80 },
  ),
  evolution(
    'pentagram',
    'tome',
    { id: 'fullmoon', name: 'Luna Preciosa', description: 'Borra a los enemigos de la pantalla y te entrega toda la experiencia.', icon: 'w_fullmoon', color: 0xfff2b0 },
    { damage: 100, cooldown: 18, area: 260 },
  ),
  evolution(
    'mana',
    'skull',
    { id: 'cataract', name: 'Partitura de Maná', description: 'Una columna enorme que ralentiza para siempre a quien golpea.', icon: 'w_cataract', proj: 'x_cataract' },
    { damage: 100, cooldown: 3, area: 48, duration: 2.5 },
  ),
  evolution(
    'clock',
    { passives: ['silverring', 'goldring'], maxed: true },
    { id: 'eternal', name: 'Corredor del Infinito', description: 'Congela y, en cada vuelta completa, parte por la mitad la vida de todo lo que hay en pantalla.', icon: 'w_eternal' },
    { cooldown: 0.75, area: 220, duration: 6 },
  ),
  evolution(
    'laurel',
    { passives: ['medalleft', 'medalright'], maxed: true },
    { id: 'thornmail', name: 'Sudario Carmesí', description: 'Tres cargas; ningún golpe te quita más de 10 de vida y cada carga gastada estalla devolviendo el daño.', icon: 'w_thornmail', color: 0xff5a6a },
    { cooldown: 6, amount: 3, area: 40, knockback: 20 },
  ),
  evolution(
    'vento',
    { union: 'galewhip' },
    { id: 'galedance', name: 'Vendaval Carmesí', description: 'Tajos delante y un círculo de cortes a tu alrededor; sus críticos curan y estallan.', icon: 'w_galedance', proj: 'x_galedance', interval: 0.05, crit: 0.05 },
    { damage: 32, cooldown: 1.5, amount: 8, area: 110, duration: 0.4, knockback: 5 },
  ),
  evolution(
    'victory',
    { passives: ['puzzlebox'], maxed: true },
    { id: 'sole', name: 'Solución Única', description: 'Cada 20 s, una galaxia arrasa la pantalla durante 10 s y te vuelve intocable.', icon: 'w_sole', color: 0x8f7bff },
    { damage: 32, cooldown: 20, area: 400, duration: 10 },
  ),
  evolution(
    'misspell',
    { passives: ['puzzlebox'], maxed: true },
    { id: 'muspell', name: 'Cenizas de Exizografía', description: 'Llamas negras hacia delante y hacia atrás; su daño crece con cada 5000 muertes.', icon: 'w_muspell', proj: 'x_ashflame', interval: 0.04 },
    { damage: 80, cooldown: 1.5, amount: 12, area: 14, speed: 195, duration: 0.4, knockback: 2 },
  ),
  evolution(
    'phaser',
    { passives: ['hourglass'], maxed: true },
    { id: 'photonstorm', name: 'Tormenta de Fotones', description: 'Tormentas de haces de todos los colores; la suerte multiplica los disparos.', icon: 'w_photonstorm', interval: 0.06 },
    { damage: 40, cooldown: 3.75, amount: 6, area: 7.5, knockback: 2 },
  ),
  evolution(
    'unearthly',
    { passives: ['tiramisu'], maxed: true },
    { id: 'spirit', name: 'Interrupción Espiritual', description: 'Un dragón espectral vuela sobre ti y lanza rayos que siempre estallan.', icon: 'w_spirit', interval: 0.1, crit: 1 },
    { damage: 16, cooldown: 3, amount: 3, area: 18, speed: 2, duration: 0.1, knockback: 2 },
  ),
  evolution(
    'ammo',
    { passives: ['feather'], maxed: true },
    { id: 'gunastrophe', name: 'Pistolastrofe', description: 'Oleadas de pistolas que entran por la esquina y rebotan por toda la pantalla.', icon: 'w_gunastrophe', proj: 'x_gun', interval: 0.2 },
    { damage: 10, cooldown: 4.5, amount: 2, area: 6, speed: 150, duration: 3, knockback: 5 },
  ),
  evolution(
    'chain',
    'horn',
    { id: 'judgement', name: 'Juicio en Cadena', description: 'Cada salto del rayo se bifurca en dos y sus golpes son a menudo críticos.', icon: 'w_judgement', color: 0xfff0a0, crit: 0.1 },
    { damage: 34, cooldown: 1, amount: 2, pierce: 12, area: 80, knockback: 6 },
  ),
  evolution(
    'quake',
    'scales',
    { id: 'sunquake', name: 'Cataclismo Solar', description: 'Ondas enormes que aturden; al llegar a su borde estallan columnas de luz.', icon: 'w_sunquake', color: 0xffe08a, interval: 0.3 },
    { damage: 78, cooldown: 2.1, amount: 2, area: 100, duration: 0.4, knockback: 90 },
  ),
  evolution(
    'vortex',
    'lodestone',
    { id: 'eventhorizon', name: 'Horizonte de Sucesos', description: 'Vórtices que lo engullen todo, también la experiencia, y acaban en una implosión devastadora.', icon: 'w_eventhorizon', color: 0xff7ac3 },
    { damage: 21, cooldown: 3.5, amount: 2, area: 60, speed: 160, duration: 3 },
  ),
];

/** Evolución de cada arma (también de la segunda arma de una fusión). */
export const EVOLUTION_BY_WEAPON = new Map<string, EvolutionDef>(
  EVOLUTIONS.flatMap((e) => (e.union ? [[e.weapon, e] as const, [e.union, e] as const] : [[e.weapon, e] as const])),
);

/** Lo que pide una evolución además del arma base al máximo: armas (fusión) y pasivas. */
export function ingredientsOf(e: EvolutionDef): { kind: 'passive' | 'weapon'; id: string }[] {
  return [...(e.union ? [{ kind: 'weapon' as const, id: e.union }] : []), ...e.passives.map((id) => ({ kind: 'passive' as const, id }))];
}
