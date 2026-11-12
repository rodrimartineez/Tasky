/**
 * Tipos de la simulación. Todo el estado de una partida es datos planos (sin clases ni referencias a la pantalla):
 * se puede ejecutar sin render (tests, simulador de economía) y serializar (reanudar partidas, Fase 4).
 */

/** Estadísticas del personaje. Las mejoras permanentes (Fase 4) y las pasivas de la partida las modifican. */
export interface Stats {
  maxHp: number;
  /** Vida por segundo. */
  regen: number;
  /** Daño que se resta de cada golpe recibido. */
  armor: number;
  /** Píxeles por segundo. */
  moveSpeed: number;
  /** Multiplicador de daño. */
  might: number;
  /** Multiplicador de área de las armas. */
  area: number;
  /** Multiplicador del tiempo entre ataques (menos = más rápido). */
  cooldown: number;
  /** Multiplicador de velocidad de proyectiles. */
  projSpeed: number;
  /** Multiplicador de duración de los efectos. */
  duration: number;
  /** Proyectiles extra en cada arma. */
  amount: number;
  /** Radio de recogida, en píxeles. */
  pickup: number;
  /** Multiplicador de suerte (cofres, opciones extra, objetos). */
  luck: number;
  /** Multiplicador de experiencia. */
  growth: number;
  /** Multiplicador de oro. */
  greed: number;
  critChance: number;
  critMult: number;
  /** Veces que se puede revivir en la partida (con media vida y unos segundos de invulnerabilidad). */
  revival: number;
  /** Veces por partida que se pueden repetir las opciones de una subida de nivel. */
  rerolls: number;
  /** Opciones que se pueden descartar para siempre en la partida. */
  banishes: number;
  /** Fracción del daño causado que se recupera como vida. */
  leech: number;
}

export const BASE_STATS: Stats = {
  maxHp: 100,
  regen: 0,
  armor: 0,
  moveSpeed: 62,
  might: 1,
  area: 1,
  cooldown: 1,
  projSpeed: 1,
  duration: 1,
  amount: 0,
  pickup: 28,
  luck: 1,
  growth: 1,
  greed: 1,
  critChance: 0.05,
  critMult: 2,
  revival: 0,
  rerolls: 0,
  banishes: 0,
  leech: 0,
};

/** Valores de un arma en su nivel actual (cada comportamiento usa los que necesita). */
export interface WeaponStats {
  damage: number;
  /** Segundos entre ataques. */
  cooldown: number;
  amount: number;
  /** Enemigos que atraviesa cada proyectil (o saltos de un rayo). */
  pierce: number;
  /** Radio o alcance, en píxeles. */
  area: number;
  speed: number;
  /** Segundos que dura el efecto. */
  duration: number;
  knockback: number;
}

export interface WeaponLevel {
  /** Texto de la mejora que se muestra al subir de nivel. */
  text: string;
  mods: Partial<WeaponStats>;
}

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  /** Tipo de ataque para el catálogo (p. ej. «Órbita»). Obligatorio en las armas base; las evoluciones heredan el de su base. */
  attack?: string;
  /** Sprite del icono (game/sprites). */
  icon: string;
  base: WeaponStats;
  /** Niveles 2…8: cada uno suma sus `mods` a los valores anteriores (vacío en las evoluciones). */
  levels: WeaponLevel[];
  /** Sprite del proyectil, si no es el de siempre del comportamiento. */
  proj?: string;
  /** Color (0xRRGGBB) de los destellos de la propia arma. */
  color?: number;
  /** Evoluciones: id del arma base, de la que heredan el comportamiento. */
  evolvedFrom?: string;
}

export interface PassiveDef {
  id: string;
  name: string;
  icon: string;
  /** Texto de cada nivel, p. ej. «+10 % de daño». */
  text: string;
  maxLevel: number;
  /** Aplica `level` niveles de la pasiva a las estadísticas. */
  apply(stats: Stats, level: number): void;
}

export type EnemyAi = 'chase' | 'charger' | 'waver' | 'shooter' | 'volley' | 'boss' | 'reaper' | 'egg';

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  ai: EnemyAi;
  /** 0 = el retroceso le afecta entero; 1 = inmune. */
  knockResist: number;
  /** Al morir se divide en este enemigo (×2). */
  splitsInto?: string;
  /** Jefes: esbirros que invoca (por defecto, osamentas). */
  minion?: string;
  /** Jefes de ciclo (content/bosses.ts): sus ataques, en orden. Sin esto, un jefe usa el patrón de los de escenario. */
  patterns?: BossPattern[];
  /** Jefes de ciclo: ataques que añaden a partir de la segunda vuelta de la rotación. */
  advanced?: BossPattern[];
  /** Color de los avisos y destellos del jefe. */
  color?: number;
}

/** Ataques de los jefes de ciclo (sim/bosses.ts). */
export type BossPattern =
  | 'radial'
  | 'fan'
  | 'spiral'
  | 'charge'
  | 'blink'
  | 'summon'
  | 'rain'
  | 'wall'
  | 'quake'
  | 'eggs'
  | 'slow'
  | 'clones'
  | 'heads'
  | 'pools'
  | 'sweep'
  | 'laser'
  | 'gravity';

/**
 * Modalidad de la partida (HABITS_GUIDE §11):
 * - `normal`: 30 minutos y aparece La Muerte; superarla es llegar al minuto 30 (y vencer al jefe en los niveles de jefe).
 * - `infinite`: sin La Muerte ni final; la dificultad sigue creciendo. No supera niveles.
 * - `mirror`: el nivel actual con dificultad doble (MIRROR_SCALE). No supera niveles.
 */
export type RunMode = 'normal' | 'infinite' | 'mirror';

/** Aparición continua de un enemigo entre dos minutos, con ritmo (por segundo) interpolado. */
export interface SpawnRule {
  enemy: string;
  from: number;
  to: number;
  rateStart: number;
  rateEnd: number;
}

export interface StageEvent {
  /** Segundo de la partida en el que ocurre. */
  at: number;
  kind: 'ring' | 'elite' | 'boss';
  enemy: string;
  count: number;
}

export interface StageDef {
  id: string;
  name: string;
  /** Oro para desbloquearlo (0 = disponible desde el principio). */
  price: number;
  /** Clave del suelo (colores en render/renderer.ts) y sprites de la decoración. */
  ground: string;
  props: string[];
  spawns: SpawnRule[];
  events: StageEvent[];
}

export interface RunConfig {
  seed: number;
  /** Nivel de la partida (1 = la primera que juega el usuario). Ver sim/difficulty.ts. */
  level: number;
  stage: StageDef;
  /** Estadísticas iniciales (personaje + mejoras permanentes). */
  stats: Stats;
  startingWeapon: string;
  /** Armas adicionales con las que se empieza (personajes especiales). */
  bonusWeapons?: string[];
  /** Sprite base del personaje elegido (`<sprite>_0` y `<sprite>_1`). */
  sprite: string;
  /** Modalidad (por defecto, normal). */
  mode?: RunMode;
  /** Multiplicador de dificultad sobre la del nivel (arcanos y estudios de equilibrio; el reflejo va aparte). Por defecto 1. */
  difficultyScale?: number;
  /** Jefe de ciclo de esta partida (niveles múltiplos de 7) y vuelta de la rotación (0 = primera). */
  cycleBoss?: { id: string; round: number };
  /** Arcano elegido (Fase 10): su id, para mostrarlo. Sus efectos ya van en `stats`, `difficultyScale` y `goldScale`. */
  arcana?: string;
  /** Multiplicador del oro de la partida (arcanos). Por defecto 1. */
  goldScale?: number;
  /** Aspecto del personaje (solo visual): tinte y aura. */
  skin?: { tint: number; aura?: number };
}

export interface WeaponState {
  id: string;
  level: number;
  stats: WeaponStats;
  /** Segundos hasta el próximo ataque. */
  timer: number;
  /** Daño total causado en la partida (resumen final). */
  dealt: number;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  /** Última dirección de movimiento (para armas direccionales y para orientar el sprite). */
  dirX: number;
  dirY: number;
  moving: boolean;
  /** Segundos de invulnerabilidad tras un golpe. */
  hurtTimer: number;
  level: number;
  xp: number;
  xpNext: number;
  stats: Stats;
  weapons: WeaponState[];
  passives: { id: string; level: number }[];
  /** Repeticiones y descartes que quedan en la partida (las partidas guardadas antiguas no los tienen). */
  rerolls: number;
  banishes: number;
  /** Ids de armas y pasivas descartadas: no vuelven a ofrecerse. */
  banished: string[];
}

export interface Enemy {
  uid: number;
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  radius: number;
  elite: boolean;
  /** Veterano (Fase 8): aparición normal reforzada, cada vez más frecuente con los minutos. */
  champion?: boolean;
  /** Retroceso pendiente. */
  kx: number;
  ky: number;
  /** Segundos de destello tras un golpe. */
  flash: number;
  /** Temporizadores del comportamiento. */
  t1: number;
  t2: number;
  /** Estado del comportamiento (p. ej. 0 acercarse, 1 preparar, 2 embestir). */
  state: number;
  vx: number;
  vy: number;
  /** Segundos hasta que un arma de contacto continuo (orbes, aura) puede volver a golpearlo. */
  contactCd: number;
  /** Marca de la última consulta espacial que lo devolvió (evita repetidos). */
  stamp: number;
  dead: boolean;
  /** Jefes de ciclo: ataque en curso (índice), su cronómetro interno y un ángulo de trabajo. */
  pattern?: number;
  sub?: number;
  aim?: number;
}

export type ProjKind =
  | 'bolt'
  | 'lance'
  | 'orbit'
  | 'bomb'
  | 'enemyShot'
  /** Látigo: daño instantáneo en un sector; el proyectil es solo el destello. */
  | 'slash'
  | 'boomerang'
  | 'mine'
  /** Haz giratorio alrededor del jugador. */
  | 'beam'
  | 'meteor'
  | 'cloud'
  /** Cuchilla que rebota de un enemigo a otro. */
  | 'ricochet'
  /** Dron que orbita al jugador y dispara al enemigo más cercano. */
  | 'drone'
  /** Llama que queda en el suelo y quema a quien la pisa. */
  | 'flame';

export interface Projectile {
  kind: ProjKind;
  sprite: string;
  weapon: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  life: number;
  pierce: number;
  knockback: number;
  /** Ángulo de dibujo (y de órbita). */
  angle: number;
  /** Órbita: radio alrededor del jugador. */
  orbitR: number;
  /** Bomba, meteorito y mina: origen, destino y duración total (en nubes y haces, `total` es el cronómetro del daño). */
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  total: number;
  /** Enemigos ya golpeados por este proyectil. */
  hit: number[];
  dead: boolean;
}

export type PickupKind = 'xp' | 'coin' | 'heart' | 'chest' | 'magnet';

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
  /** Ya vuela hacia el jugador. */
  pulled: boolean;
  dead: boolean;
}

/** Efectos visuales que la simulación emite y el render consume (sin efecto en el juego). */
export type Fx =
  | { type: 'number'; x: number; y: number; value: number; crit: boolean; player: boolean }
  | { type: 'puff'; x: number; y: number; color: number; count: number }
  /** Impacto animado de un arma: sprites `<sprite>_0`, `_1` y `_2` (anticipación, impacto, disipación). */
  | { type: 'hit'; x: number; y: number; sprite: string }
  | { type: 'ring'; x: number; y: number; radius: number; color: number }
  | { type: 'line'; x: number; y: number; x2: number; y2: number; color: number }
  | { type: 'shake'; power: number };

/**
 * Zona de peligro de los jefes. Se avisa hasta `at`; entonces:
 * - `blast` (por defecto): estalla una vez en su círculo. `ring`: estalla en la corona entre `inner` y `radius`.
 * - `zone`: hace daño mientras dura (hasta `until`). `slow`: ralentiza mientras dura.
 * - `beam`: rayo de (x, y) a (x2, y2) con grosor `radius`, activo hasta `until`.
 */
export interface Hazard {
  x: number;
  y: number;
  at: number;
  radius: number;
  damage: number;
  kind?: 'blast' | 'ring' | 'zone' | 'slow' | 'beam';
  until?: number;
  inner?: number;
  x2?: number;
  y2?: number;
  color?: number;
}

export interface UpgradeChoice {
  kind: 'weapon' | 'passive' | 'gold' | 'heal' | 'evolution' | 'purge';
  id: string;
  name: string;
  icon: string;
  /** Nivel que tendrá al elegirla (1 = nueva). */
  level: number;
  text: string;
  /** Si al elegirla se completa una evolución (arma al máximo + pasiva): nombre del arma evolucionada. */
  evolves?: string;
}

/** `purge`: eligiendo qué armas y pasivas eliminar (mejora especial). */
export type Phase = 'playing' | 'levelup' | 'purge' | 'dead';

export interface World {
  config: RunConfig;
  rngState: number;
  phase: Phase;
  /** Segundos de partida. */
  time: number;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  pickups: Pickup[];
  fx: Fx[];
  nextUid: number;
  kills: number;
  gold: number;
  /** Subidas de nivel pendientes de elegir. */
  pendingLevels: number;
  choices: UpgradeChoice[];
  /** Últimas mejoras concedidas por un cofre (la interfaz las muestra y las vacía). */
  chestRewards: UpgradeChoice[];
  /** Oro del último cofre (se muestra con sus mejoras). */
  chestGold?: number;
  /** Oleadas ya empezadas (cada minuto, sim/core.ts WAVES). */
  waves?: number;
  /** Nivel del personaje desde el que se ofrece una vez la mejora de eliminar (solo en ~1 de cada 5 partidas). */
  purgeAt?: number;
  /** Acumuladores de aparición por regla y siguiente evento del escenario. */
  spawnAcc: number[];
  nextEvent: number;
  bossAlive: boolean;
  /** Se llegó al minuto 30 (en modo normal o reflejo): ha aparecido La Muerte. */
  completed?: boolean;
  /** Jefe de ciclo: 0 = no ha aparecido, 1 = vivo, 2 = vencido. */
  cycleBoss?: number;
  /** Modo infinito: vueltas completas a los eventos del escenario. */
  eventLoops?: number;
  /** Ataques de jefe retardados (zonas que estallan tras un aviso). */
  hazards?: Hazard[];
  /** El jugador pisa una zona que ralentiza (se recalcula en cada paso). */
  slowed?: boolean;
}

export interface RunResult {
  /** Nivel superado: llegó al minuto 30 en modo normal (y venció al jefe de ciclo, si lo había). */
  won: boolean;
  /** Llegó al minuto 30 (apareció La Muerte). */
  completed: boolean;
  mode: RunMode;
  time: number;
  level: number;
  kills: number;
  /** Oro total, incluida la bonificación por supervivencia. */
  gold: number;
  survivalBonus: number;
  weapons: { id: string; level: number; dealt: number }[];
}

/** Duración máxima de una partida. */
export const RUN_SECONDS = 30 * 60;
export const MAX_WEAPONS = 5;
export const MAX_PASSIVES = 5;
