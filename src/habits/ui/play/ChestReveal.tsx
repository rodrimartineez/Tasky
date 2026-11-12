import { useEffect, useState } from 'react';
import { play } from '../../../game/audio/sfx';
import type { UpgradeChoice } from '../../../game/sim/types';
import { spriteDataUrl } from '../../../game/sprites/atlas';
import shared from './GameScreen.module.css';
import styles from './ChestReveal.module.css';

/** Tiempos de la presentación (ms): sacudida del cofre cerrado y aparición de cada mejora. */
const SHAKE_MS = 900;
const STEP_MS = 520;
const SPARKS = 18;

function rewardLine(c: UpgradeChoice): string {
  if (c.kind === 'evolution') return `¡Evolución! ${c.text}`;
  if (c.kind === 'weapon' || c.kind === 'passive') return `Nivel ${c.level}`;
  return c.text;
}

/**
 * Apertura de cofre a pantalla completa: el cofre aparece en grande y se sacude, se abre con un destello, rayos y
 * chispas, y las mejoras salen de una en una; al final, el oro. Tocar adelanta la animación; con todo a la vista,
 * «Continuar» devuelve a la partida.
 */
export function ChestReveal({ rewards, gold, onClose }: { rewards: UpgradeChoice[]; gold: number; onClose: () => void }) {
  // -1: cerrado; 0…n: mejoras ya mostradas; n + 1: también el oro (todo a la vista).
  const [shown, setShown] = useState(-1);
  const total = rewards.length + 1;
  const done = shown >= total;

  // Sonido de cada paso: sacudida, apertura, cada mejora (fanfarria si es una evolución) y el oro.
  useEffect(() => {
    if (shown < 0) play('chestShake');
    else if (shown === 0) play('chestOpen');
    else if (shown <= rewards.length) play(rewards[shown - 1].kind === 'evolution' ? 'evolution' : 'reward');
    else play('gold');
  }, [shown, rewards]);

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setShown((s) => s + 1), shown < 0 ? SHAKE_MS : STEP_MS);
    return () => clearTimeout(timer);
  }, [shown, done]);

  const skip = () => {
    if (!done) setShown(total);
  };

  const open = shown >= 0;
  return (
    <div className={`${shared.overlay} ${styles.overlay}`} onClick={skip} role="dialog" aria-label="Cofre">
      <div className={styles.stage}>
        {open && <div className={styles.rays} aria-hidden />}
        {open && <div className={styles.flash} aria-hidden />}
        {open &&
          Array.from({ length: SPARKS }, (_, i) => (
            <i
              key={i}
              className={styles.spark}
              style={{ '--angle': `${(360 / SPARKS) * i + (i % 3) * 7}deg`, '--dist': `${70 + (i % 4) * 22}px` } as React.CSSProperties}
              aria-hidden
            />
          ))}
        <img
          className={`${styles.chest} ${open ? styles.opened : styles.shaking}`}
          src={spriteDataUrl(open ? 'i_chest_open' : 'i_chest')}
          alt=""
          draggable={false}
        />
      </div>
      <h2 className={shared.title}>{open ? (rewards.length > 1 ? `¡${rewards.length} mejoras!` : '¡Mejora!') : '¡Cofre!'}</h2>
      <ul className={styles.rewards}>
        {rewards.slice(0, Math.max(0, shown)).map((c, i) => (
          <li key={i} className={`${styles.reward} ${c.kind === 'evolution' ? styles.evolution : ''}`}>
            <img src={spriteDataUrl(c.icon)} alt="" draggable={false} />
            <span>
              <b>{c.name}</b>
              <small>{rewardLine(c)}</small>
            </span>
          </li>
        ))}
      </ul>
      {shown >= total && (
        <p className={styles.gold}>
          <img src={spriteDataUrl('i_coin')} alt="" draggable={false} /> +{gold.toLocaleString('es-ES')} de oro
        </p>
      )}
      <button
        type="button"
        className={shared.primary}
        disabled={!done}
        style={{ visibility: done ? 'visible' : 'hidden' }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        Continuar
      </button>
    </div>
  );
}
