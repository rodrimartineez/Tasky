import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, Skull } from 'lucide-react';
import { PASSIVE_BY_ID } from '../../../game/content/passives';
import { WEAPON_BY_ID } from '../../../game/content/weapons';
import { Game, type Hud } from '../../../game/Game';
import type { RunConfig, RunResult, UpgradeChoice, World } from '../../../game/sim/types';
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

interface GameScreenProps {
  level: number;
  config: RunConfig;
  /** Estado guardado para continuar una partida interrumpida. */
  resume: World | null;
  /** Fin de la partida (muerte, victoria o abandono): se llama una sola vez. */
  onFinish: (result: RunResult) => void;
  onExit: () => void;
}

/** Partida a pantalla completa. Se monta al empezar a jugar (el motor se descarga en ese momento). */
export default function GameScreen({ level, config, resume, onFinish, onExit }: GameScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const finishedRef = useRef(false);
  // La partida se arranca una sola vez con los valores iniciales de las props.
  const startRef = useRef({ level, config, resume, onFinish });
  const [hud, setHud] = useState<Hud | null>(null);
  const [choices, setChoices] = useState<UpgradeChoice[] | null>(null);
  const [chest, setChest] = useState<UpgradeChoice[] | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let chestTimer: ReturnType<typeof setTimeout> | undefined;
    const start = startRef.current;
    const save = () => {
      const world = finishedRef.current ? null : gameRef.current?.snapshot();
      if (world) void saveRunSnapshot({ level: start.level, savedAt: now(), world });
    };
    const saveTimer = setInterval(save, SAVE_MS);
    const onHidden = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', save);
    Game.start(
      host,
      start.config,
      {
        onHud: setHud,
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
        if (!cancelled) setFailed(true);
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
    gameRef.current?.choose(index);
  }, []);

  // Teclado: 1–4 eligen la mejora.
  useEffect(() => {
    if (!choices) return;
    const onKey = (e: KeyboardEvent) => {
      const index = Number(e.key) - 1;
      if (index >= 0 && index < choices.length) choose(index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, choose]);

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
            {hud.weapons.map((w) => (
              <span key={w.id} className={styles.slot} title={WEAPON_BY_ID.get(w.id)?.name}>
                <Icon name={WEAPON_BY_ID.get(w.id)?.icon ?? ''} size={18} />
                <i>{w.level}</i>
              </span>
            ))}
            {hud.passives.map((p) => (
              <span key={p.id} className={`${styles.slot} ${styles.passive}`} title={PASSIVE_BY_ID.get(p.id)?.name}>
                <Icon name={PASSIVE_BY_ID.get(p.id)?.icon ?? ''} size={18} />
                <i>{p.level}</i>
              </span>
            ))}
          </div>
          {hud.bossAlive && <div className={styles.boss}>¡Jefe!</div>}
          {chest && (
            <div className={styles.chest} role="status">
              <Icon name="i_chest" size={28} />
              <div>
                {chest.map((c, i) => (
                  <p key={i}>
                    {c.name} {c.kind === 'weapon' || c.kind === 'passive' ? `→ Nv ${c.level}` : `· ${c.text}`}
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
            <p className={styles.subtitle}>Elige una mejora</p>
            {choices.map((c, i) => (
              <button key={`${c.id}-${c.level}`} type="button" className={styles.choice} onClick={() => choose(i)}>
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
                </span>
                <kbd className={styles.key}>{i + 1}</kbd>
              </button>
            ))}
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
              Terminar partida (te quedas el oro)
            </button>
            <p className={styles.note}>
              Muévete con el dedo (o WASD / flechas). El ataque es automático. {hud ? `${hud.fps} fps` : ''}
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
                <b>{result.gold}</b>
              </div>
            </div>
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
              El oro ya está guardado. La próxima partida será el nivel {level + 1}.
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
            <p className={styles.note}>Este dispositivo o navegador no ha podido arrancar los gráficos.</p>
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
