import { Lock } from 'lucide-react';
import { useState } from 'react';
import { spriteDataUrl } from '../../../game/sprites/atlas';
import { Button } from '../../../ui/components/Button';
import { Dialog } from '../../../ui/components/Dialog';
import styles from './CardPickerDialog.module.css';

export interface PickableCard {
  id: string;
  name: string;
  dark: boolean;
  icon: string;
  text: string;
  owned: boolean;
  /** Nombre del logro de hábitos que la desbloquea. */
  achievement: string;
}

interface Props {
  open: boolean;
  cards: PickableCard[];
  /** Cuántas se pueden llevar como máximo. */
  max: number;
  /** Las elegidas la última vez (ya filtradas por las desbloqueadas). */
  initial: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

/** Menú de arcanas y darkanas: se abre al pulsar «Jugar», antes de gastar el intento. */
export function CardPickerDialog({ open, cards, max, initial, onConfirm, onClose }: Props) {
  const [picked, setPicked] = useState<string[]>(initial);
  // Carta cuyo texto se muestra: la última tocada (al abrir, la primera elegida o la primera de todas).
  const [shown, setShown] = useState(initial[0] ?? cards[0]?.id);
  const info = cards.find((c) => c.id === shown) ?? cards[0];
  const toggle = (card: PickableCard) => {
    setShown(card.id);
    if (!card.owned) return;
    setPicked((p) => (p.includes(card.id) ? p.filter((x) => x !== card.id) : [...p, card.id].slice(-max)));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Elige tus cartas"
      description={`Hasta ${max} arcanas o darkanas para esta partida (${picked.length}/${max}). Se desbloquean con logros de hábitos.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => onConfirm(picked)}>
            {picked.length > 0 ? 'Empezar' : 'Empezar sin cartas'}
          </Button>
        </>
      }
    >
      <div className={styles.grid}>
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`${styles.card} ${picked.includes(c.id) ? styles.on : ''} ${c.owned ? '' : styles.locked} ${c.id === info?.id ? styles.shown : ''}`}
            aria-pressed={picked.includes(c.id)}
            aria-label={c.name}
            onClick={() => toggle(c)}
          >
            <img className={styles.art} src={spriteDataUrl(c.icon)} alt="" draggable={false} />
            {!c.owned && <Lock className={styles.lockIcon} size={16} />}
          </button>
        ))}
      </div>
      {info && (
        <div className={styles.info} aria-live="polite">
          <b className={styles.name}>{info.name}</b>
          <span className={styles.kind}>{info.dark ? 'Darkana' : 'Arcana'}</span>
          <span className={styles.text}>{info.text}</span>
          {!info.owned && (
            <span className={styles.lock}>
              <Lock size={12} /> Se desbloquea con el logro «{info.achievement}»
            </span>
          )}
        </div>
      )}
    </Dialog>
  );
}
