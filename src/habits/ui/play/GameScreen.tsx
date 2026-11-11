import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Dices, Pause, Play, Skull } from 'lucide-react';
import { PASSIVE_BY_ID } from '../../../game/content/passives';
import { WEAPON_BY_ID } from '../../../game/content/weapons';
import { Game, type Hud } from '../../../game/Game';
import { MAX_PASSIVES, MAX_WEAPONS, type RunConfig, type RunResult, type UpgradeChoice, type World } from '../../../game/sim/types';
import { spriteDataUrl } from '../../../game/sprites/atlas';
import { now } from '../../../core/clock';
import { saveRunSnapshot } from '../../state/store';
import styles from './GameScreen.module.css';

/** Cada cuánto se guarda la partida para poder reanudarla (también al ocultar la app). */
const SAVE_MS = 10_000;

const clock = (seconds: number) => {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return <img className={styles.icon} src={spriteDataUrl(name)} alt="" style={{ width: size, height: size }} draggable={false} />;
}

/** Una fila de huecos de la partida: los ocupados con su icono y nivel, y los libres como marcos tenues. */
function Slots({
  items,
  total,
  defs,
  passive = false,
}: {
  items: { id: string; level: number; ready?: boolean }[];
  total: number;
  defs: Map<string, { name: string; icon: string; evolvedFrom?: string }>;
  passive?: boolean;
}) {
  return (
    <div className={`${styles.slots} ${passive ? styles.passive : ''}`}>
      {Array.from({ length: total }, (_, i) => {
        const item = items[i];
        const def = item && defs.get(item.id);
        return def ? (
          <span
            key={item.id}
            className={`${styles.slot} ${def.evolvedFrom ? styles.evolved : ''}`}
            title={item.ready ? `${def.name}: ¡puede evolucionar! Abre un cofre` : def.name}
          >
            <img className={styles.slotIcon} src={spriteDataUrl(def.icon)} alt="" draggable={false} />
            {item.ready && <b className={styles.star}>★</b>}
            <i>{def.evolvedFrom ? 'Evo' : item.level}</i>
          </span>
        ) : (
          <span key={`empty-${i}`} className={`${styles.slot} ${styles.empty}`} />
        );
      })}
    </div>
  );
}

interface GameScreenProps {
  level: number;
  config: RunConfig;
  /** Estado guardado para continuar una partida interrumpida. */
  resume: World | null;
  /** Fin de la partida (muerte, victoria o abandono): se llama una sola vez. */
  onFinish: (result: RunResult) => void;
  onExit: () => void;
  /** Partida del modo de pruebas (el resultado no se guarda). */
  test: boolean;
}

/** Partida a pantalla completa. Se monta al empezar a jugar (el motor se descarga en ese momento). */
export default function GameScreen({ level, config, resume, onFinish, onExit, test }: GameScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const finishedRef = useRef(false);
  // La partida se arranca una sola vez con los valores iniciales de las props.
  const startRef = useRef({ level, config, resume, onFinish, test });
  const [hud, setHud] = useState<Hud | null>(null);
  const [choices, setChoices] = useState<UpgradeChoice[] | null>(null);
  const [chest, setChest] = useState<UpgradeChoice[] | null>(null);
  const [paused, setPaused] = useState(false);
  // Modo «Descartar»: el siguiente clic en una opción la quita para siempre.
  const [banishing, setBanishing] = useState(false);
  const hudRef = useRef<Hud | null>(null);
  // Mayor número de repeticiones/descartes visto: los botones solo aparecen si el jugador tiene esas mejoras.
  const [tools, setTools] = useState({ rerolls: 0, banishes: 0 });
  const [result, setResult] = useState<RunResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Mientras se juega, la página de detrás no se desplaza ni rebota (iOS).
  useEffect(() => {
    const { style } = document.documentElement;
    const previous = style.overflow;
    style.overflow = 'hidden';
    return () => {
      style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let chestTimer: ReturnType<typeof setTimeout> | undefined;
    const start = startRef.current;
    const save = () => {
      const world = finishedRef.current ? null : gameRef.current?.snapshot();
      if (world) void saveRunSnapshot({ level: start.level, savedAt: now(), world, ...(start.test ? { test: true } : {}) }, start.test);
    };
    const saveTimer = setInterval(save, SAVE_MS);
    const onHidden = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', save);
    Game.start(
      host,
      start.config,
      {
        onHud: (h) => {
          hudRef.current = h;
          setTools((t) => (h.rerolls > t.rerolls || h.banishes > t.banishes ? { rerolls: Math.max(t.rerolls, h.rerolls), banishes: Math.max(t.banishes, h.banishes) } : t));
          setHud(h);
        },
        onLevelUp: (c) => setChoices([...c]),
        onChest: (rewards) => {
          setChest([...rewards]);
          clearTimeout(chestTimer);
          chestTimer = setTimeout(() => setChest(null), 2800);
        },
        onPause: setPaused,
        onEnd: (r) => {
          finishedRef.current = true;
          start.onFinish(r);
          setResult(r);
        },
      },
      start.resume,
    )
      .then((game) => {
        // Si la pantalla se cerró mientras cargaba el motor, se libera en cuanto esté listo.
        if (cancelled) game.destroy();
        else gameRef.current = game;
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setFailed(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      clearTimeout(chestTimer);
      clearInterval(saveTimer);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', save);
      save();
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  const choose = useCallback((index: number) => {
    setChoices(null);
    setBanishing(false);
    gameRef.current?.choose(index);
  }, []);

  const reroll = useCallback(() => {
    if (!hudRef.current?.rerolls) return;
    setBanishing(false);
    gameRef.current?.reroll();
  }, []);

  const toggleBanish = useCallback(() => {
    if (hudRef.current?.banishes) setBanishing((b) => !b);
  }, []);

  /** Clic o tecla numérica sobre una opción: la elige o, en modo Descartar, la descarta. */
  const pick = useCallback(
    (index: number) => {
      if (!banishing) return choose(index);
      setBanishing(false);
      gameRef.current?.banish(index);
    },
    [banishing, choose],
  );

  // Teclado: 1–4 eligen la mejora, R repite las opciones, D activa el modo Descartar.
  useEffect(() => {
    if (!choices) return;
    const onKey = (e: KeyboardEvent) => {
      const index = Number(e.key) - 1;
      if (index >= 0 && index < choices.length) pick(index);
      else if (e.key === 'r' || e.key === 'R') reroll();
      else if (e.key === 'd' || e.key === 'D') toggleBanish();
      else if (e.key === 'Escape') setBanishing(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, pick, reroll, toggleBanish]);

  const abandon = () => {
    const game = gameRef.current;
    if (!game || finishedRef.current) return;
    finishedRef.current = true;
    const r = game.abandon();
    onFinish(r);
    setResult(r);
  };

  return createPortal(
    <div className={styles.screen}>
      <div ref={hostRef} className={styles.canvas} />

      {hud && !result && (
        <div className={styles.hud}>
          <div className={styles.xp}>
            <span style={{ width: `${Math.min(100, (hud.xp / hud.xpNext) * 100)}%` }} />
          </div>
          <div className={styles.top}>
            <span className={styles.level}>
              Nivel {level} · Nv {hud.level}
            </span>
            <span className={styles.timer}>{clock(hud.time)}</span>
            <span className={styles.counters}>
              <span>
                <Skull /> {hud.kills}
              </span>
              <span>
                <Icon name="i_coin" size={14} /> {hud.gold}
              </span>
            </span>
            <button type="button" className={styles.pause} onClick={() => gameRef.current?.setPaused(true)} aria-label="Pausa">
              <Pause />
            </button>
          </div>
          <div className={styles.loadout}>
            <Slots items={hud.weapons} total={MAX_WEAPONS} defs={WEAPON_BY_ID} />
            <Slots items={hud.passives} total={MAX_PASSIVES} defs={PASSIVE_BY_ID} passive />
          </div>
          {hud.bossAlive && <div className={styles.boss}>¡Jefe!</div>}
          {chest && (
            <div className={styles.chest} role="status">
              <Icon name="i_chest" size={28} />
              <div>
                {chest.map((c, i) => (
                  <p key={i} className={c.kind === 'evolution' ? styles.evolution : ''}>
                    {c.kind === 'evolution' ? `¡Evolución! ${c.text}` : `${c.name} ${c.kind === 'weapon' || c.kind === 'passive' ? `→ Nv ${c.level}` : `· ${c.text}`}`}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {choices && !result && (
        <div className={styles.overlay}>
          <div className={styles.panel} role="dialog" aria-label="Subida de nivel">
            <h2 className={styles.title}>¡Nivel {hud?.level ?? ''}!</h2>
            <p className={styles.subtitle}>{banishing ? 'Elige la opción que no quieres volver a ver' : 'Elige una mejora'}</p>
            {hud?.weapons.some((x) => x.ready) && <p className={styles.evoNote}>★ ¡Evolución lista! Abre un cofre de élite o jefe.</p>}
            {choices.map((c, i) => (
              <button
                key={`${c.id}-${c.level}`}
                type="button"
                className={`${styles.choice} ${banishing ? styles.banishing : ''} ${c.evolves ? styles.evolves : ''}`}
                disabled={banishing && c.kind !== 'weapon' && c.kind !== 'passive'}
                onClick={() => pick(i)}
              >
                <span className={styles.choiceIcon}>
                  <Icon name={c.icon} size={32} />
                </span>
                <span className={styles.choiceBody}>
                  <span className={styles.choiceName}>
                    {c.name}
                    {(c.kind === 'weapon' || c.kind === 'passive') && (
                      <em className={c.level === 1 ? styles.new : ''}>{c.level === 1 ? '¡Nuevo!' : `Nv ${c.level}`}</em>
                    )}
                  </span>
                  <span className={styles.choiceText}>{c.text}</span>
                  {c.evolves && <span className={styles.evoTag}>¡Evolución! → {c.evolves} (en el próximo cofre)</span>}
                </span>
                <kbd className={styles.key}>{i + 1}</kbd>
              </button>
            ))}
            {(tools.rerolls > 0 || tools.banishes > 0) && (
              <div className={styles.tools}>
                {tools.rerolls > 0 && (
                  <button type="button" className={styles.tool} disabled={!hud?.rerolls} onClick={reroll}>
                    <Dices /> Repetir ({hud?.rerolls ?? 0}) <kbd className={styles.key}>R</kbd>
                  </button>
                )}
                {tools.banishes > 0 && (
                  <button type="button" className={`${styles.tool} ${banishing ? styles.toolOn : ''}`} disabled={!hud?.banishes} onClick={toggleBanish} aria-pressed={banishing}>
                    <Ban /> Descartar ({hud?.banishes ?? 0}) <kbd className={styles.key}>D</kbd>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {paused && !choices && !result && (
        <div className={styles.overlay}>
          <div className={styles.panel} role="dialog" aria-label="Pausa">
            <h2 className={styles.title}>Pausa</h2>
            <button type="button" className={styles.primary} onClick={() => gameRef.current?.setPaused(false)}>
              <Play /> Continuar
            </button>
            <button type="button" className={styles.secondary} onClick={onExit}>
              Guardar y salir
            </button>
            <button type="button" className={styles.secondary} onClick={abandon}>
              Terminar (te quedas el oro)
            </button>
            <p className={styles.note}>
              Muévete con el dedo (o WASD / flechas). El ataque es automático. {hud ? `${hud.fps} fps · ${hud.graphics}` : ''}
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className={styles.overlay}>
          <div className={styles.panel} role="dialog" aria-label="Fin de la partida">
            <h2 className={`${styles.title} ${result.won ? '' : styles.lost}`}>{result.won ? '¡Has sobrevivido!' : 'Fin de la partida'}</h2>
            <div className={styles.results}>
              <div>
                <span>Tiempo</span>
                <b>{clock(result.time)}</b>
              </div>
              <div>
                <span>Nivel</span>
                <b>{result.level}</b>
              </div>
              <div>
                <span>Enemigos</span>
                <b>{result.kills}</b>
              </div>
              <div>
                <span>Oro</span>
                <b>{result.gold.toLocaleString('es-ES')}</b>
              </div>
            </div>
            {result.survivalBonus > 0 && (
              <p className={styles.note}>
                Incluye {result.survivalBonus.toLocaleString('es-ES')} de oro de bonificación por sobrevivir {Math.floor(result.time / 60)} minutos.
              </p>
            )}
            <ul className={styles.damage}>
              {[...result.weapons]
                .sort((a, b) => b.dealt - a.dealt)
                .map((w) => (
                  <li key={w.id}>
                    <Icon name={WEAPON_BY_ID.get(w.id)?.icon ?? ''} size={18} />
                    <span>
                      {WEAPON_BY_ID.get(w.id)?.name} · Nv {w.level}
                    </span>
                    <b>{Math.round(w.dealt).toLocaleString('es-ES')}</b>
                  </li>
                ))}
            </ul>
            <p className={styles.note}>
              {test ? 'Partida de prueba: el oro no se guarda.' : `El oro ya está guardado. La próxima partida será el nivel ${level + 1}.`}
            </p>
            <button type="button" className={styles.primary} onClick={onExit}>
              Volver al campamento
            </button>
          </div>
        </div>
      )}

      {failed && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h2 className={`${styles.title} ${styles.lost}`}>No se pudo iniciar el juego</h2>
            <p className={styles.note}>Este dispositivo o navegador no ha podido arrancar los gráficos. Prueba a cerrar otras pestañas o apps y vuelve a intentarlo.</p>
            <p className={styles.note}>
              <small>{failed}</small>
            </p>
            <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
              Recargar y reintentar
            </button>
            <button type="button" className={styles.secondary} onClick={onExit}>
              Volver
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
