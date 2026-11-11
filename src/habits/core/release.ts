import type { LocalDate } from '../../core/model';

/**
 * Estado de publicación del juego del modo Hábitos. Es la única pieza que cambia al pasar de pruebas a producción
 * (HABITS_GUIDE.md §10). Va en el código, no en los datos: se mantiene igual en cada despliegue y en todos los
 * dispositivos, y no puede quedar a medias por la sincronización.
 *
 * Modo de pruebas (`testMode: true`):
 * - Partidas ilimitadas, todas de nivel 1, con todos los personajes y escenarios disponibles.
 * - Las partidas de prueba **no se guardan en el ledger**: no dan oro ni gastan partidas, así que la economía
 *   definitiva no se ve afectada. Los hábitos, los puntos y las mejoras permanentes funcionan con normalidad.
 *
 * Producción (`testMode: false`):
 * - Una partida al día desde `startsOn` (acumulables) y niveles progresivos.
 * - `season` separa la progresión del juego (partidas, oro y desbloqueos) de cualquier etapa anterior: los asientos
 *   de otra temporada se ignoran. Los puntos de hábitos y las mejoras permanentes nunca dependen de la temporada.
 */
export interface GameRelease {
  testMode: boolean;
  season: number;
  /** Primer día de partidas diarias de la temporada (null = desde que se empezó a usar el modo Hábitos). */
  startsOn: LocalDate | null;
}

export const GAME_RELEASE: GameRelease = {
  testMode: true,
  season: 1,
  startsOn: null,
};
