import { useState } from 'react';
import { spriteDataUrl } from '../../../game/sprites/atlas';
import { Button } from '../../../ui/components/Button';
import { Dialog } from '../../../ui/components/Dialog';
import styles from './StartingWeaponsDialog.module.css';

interface Props {
  open: boolean;
  /** Cuántas hay que elegir. */
  count: number;
  /** Se eligen evoluciones (ya completas, al nivel máximo) en lugar de armas base. */
  evolutions?: boolean;
  options: { id: string; name: string; icon: string }[];
  onConfirm: (weaponIds: string[]) => void;
  onClose: () => void;
}

/** Elección de las armas (o evoluciones) iniciales: se abre al pulsar «Jugar», antes de gastar el intento. */
export function StartingWeaponsDialog({ open, count, evolutions = false, options, onConfirm, onClose }: Props) {
  const noun = evolutions ? (count === 1 ? 'evolución inicial' : 'evoluciones iniciales') : count === 1 ? 'arma inicial' : 'armas iniciales';
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-count)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Elige ${count} ${noun}`}
      description={`Empezarás la partida con lo que elijas (${picked.length}/${count}).`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={picked.length !== count} onClick={() => onConfirm(picked)}>
            Empezar
          </Button>
        </>
      }
    >
      <div className={styles.grid}>
        {options.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`${styles.weapon} ${picked.includes(w.id) ? styles.on : ''}`}
            aria-pressed={picked.includes(w.id)}
            onClick={() => toggle(w.id)}
          >
            <img src={spriteDataUrl(w.icon)} alt="" draggable={false} />
            <span>{w.name}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
