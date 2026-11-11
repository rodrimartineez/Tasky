import type { LocalDate } from '../../core/model';

/**
 * Estado de publicación del juego del modo Hábitos (HABITS_GUIDE.md §10).
 *
 * Modo de pruebas (`testMode: true`):
 * - Partidas ilimitadas, todas de nivel 1, con todos los personajes y escenarios disponibles.
 * - Las partidas de prueba **no se guardan en el ledger**: no dan oro, no gastan partidas ni compran nada, así que
 *   la economía real no se ve afectada. Los hábitos, los puntos y las mejoras permanentes funcionan con normalidad.
 *
 * Progresión normal (`testMode: false`):
 * - Una partida al día desde `startsOn` (acumulables), niveles progresivos, compras con oro.
 * - `season` separa la progresión del juego (partidas, oro y desbloqueos) de cualquier etapa anterior: los asientos
 *   de otra temporada se ignoran. Los puntos de hábitos y las mejoras permanentes nunca dependen de la temporada.
 */
export interface GameRelease {
  testMode: boolean;
  season: number;
  /** Primer día de partidas diarias de la temporada (null = desde que se empezó a usar el modo Hábitos). */
  startsOn: LocalDate | null;
}

/**
 * Configuración de la versión. Es lo único que se cambia en el código al publicar el juego.
 *
 * - `devTools: true` (desarrollo): el selector «Modo de pruebas» aparece en el campamento y cada dispositivo elige
 *   su modo (se recuerda en ese dispositivo y se puede cambiar en cualquier momento, sin desplegar).
 * - `devTools: false` (publicado): el selector desaparece y el modo de pruebas no se puede activar de ninguna forma.
 *
 * Temporada 0 = desarrollo: lo que se juegue con la progresión normal mientras tanto queda en la temporada 0, y al
 * publicar se pasa a la 1, que empieza de cero (§10).
 */
export const GAME_BUILD = {
  devTools: true,
  season: 0,
  startsOn: null as LocalDate | null,
} as const;

/** Configuración efectiva: el modo de pruebas solo existe si la versión tiene las herramientas de desarrollo. */
export const releaseFor = (testMode: boolean): GameRelease => ({
  testMode: GAME_BUILD.devTools && testMode,
  season: GAME_BUILD.season,
  startsOn: GAME_BUILD.startsOn,
});

/** Progresión normal (por defecto en el núcleo: el modo de pruebas hay que pedirlo expresamente). */
export const GAME_RELEASE: GameRelease = releaseFor(false);
