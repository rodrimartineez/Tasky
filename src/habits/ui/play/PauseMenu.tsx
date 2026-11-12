import { useState } from 'react';
import { Play } from 'lucide-react';
import { EVOLUTIONS } from '../../../game/content/evolutions';
import { PASSIVE_BY_ID } from '../../../game/content/passives';
import { WEAPON_BY_ID } from '../../../game/content/weapons';
import type { Hud } from '../../../game/Game';
import { MAX_PASSIVES, MAX_WEAPONS } from '../../../game/sim/types';
import { spriteDataUrl } from '../../../game/sprites/atlas';
import shared from './GameScreen.module.css';
import styles from './PauseMenu.module.css';

const Sprite = ({ name, className }: { name: string; className?: string }) => (
  <img className={className} src={spriteDataUrl(name)} alt="" draggable={false} />
);

/** Las cinco armas y las cinco pasivas que se llevan, con su nivel y lo que hacen (los huecos libres, vacíos). */
function Loadout({ hud }: { hud: Hud }) {
  const rows = (items: { id: string; level: number }[], total: number, passive: boolean) =>
    Array.from({ length: total }, (_, i) => {
      const item = items[i];
      if (!item)
        return (
          <li key={`empty-${i}`} className={`${styles.item} ${styles.free}`}>
            Hueco libre
          </li>
        );
      const weapon = passive ? undefined : WEAPON_BY_ID.get(item.id);
      const def = passive ? PASSIVE_BY_ID.get(item.id) : weapon;
      if (!def) return null;
      const text = passive ? PASSIVE_BY_ID.get(item.id)!.text : weapon!.description;
      return (
        <li key={item.id} className={styles.item}>
          <Sprite name={def.icon} className={styles.icon} />
          <span>
            <b>
              {def.name} <em>{weapon?.evolvedFrom ? `Evolución · Nv ${item.level}` : `Nv ${item.level}`}</em>
            </b>
            <small>{text}</small>
          </span>
        </li>
      );
    });
  return (
    <>
      <h3 className={styles.heading}>Armas</h3>
      <ul className={styles.list}>{rows(hud.weapons, MAX_WEAPONS, false)}</ul>
      <h3 className={styles.heading}>Pasivas</h3>
      <ul className={styles.list}>{rows(hud.passives, MAX_PASSIVES, true)}</ul>
    </>
  );
}

/** Tabla de evoluciones: arma + pasiva = evolución; lo que se lleva se ilumina y lo que falta se ve apagado. */
function Evolutions({ hud }: { hud: Hud }) {
  const weapons = new Set(hud.weapons.map((x) => x.id));
  const passives = new Set(hud.passives.map((x) => x.id));
  const cell = (icon: string, name: string, owned: boolean) => (
    <span className={`${styles.cell} ${owned ? styles.owned : styles.missing}`} title={`${name}${owned ? ' (la llevas)' : ''}`}>
      <Sprite name={icon} />
    </span>
  );
  return (
    <ul className={styles.evolutions}>
      {EVOLUTIONS.map((e) => {
        const base = WEAPON_BY_ID.get(e.weapon)!;
        const passive = PASSIVE_BY_ID.get(e.passive)!;
        const evolved = weapons.has(e.def.id);
        return (
          <li key={e.def.id} className={styles.evolution} aria-label={`${base.name} + ${passive.name} = ${e.def.name}`}>
            {cell(base.icon, base.name, evolved || weapons.has(e.weapon))}
            <i>+</i>
            {cell(passive.icon, passive.name, passives.has(e.passive))}
            <i>=</i>
            {cell(e.def.icon, e.def.name, evolved)}
            <span className={styles.evoName}>{e.def.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Menú de pausa: continuar, ver el equipamiento, la tabla de evoluciones, o guardar y salir. */
/** `final`: modo infinito pasado el minuto 15; salir termina la partida (no se guarda para volver). */
export function PauseMenu({ hud, onResume, onExit, final = false }: { hud: Hud | null; onResume: () => void; onExit: () => void; final?: boolean }) {
  const [view, setView] = useState<'menu' | 'loadout' | 'evolutions'>('menu');
  if (view !== 'menu' && hud)
    return (
      <div className={shared.overlay}>
        <div className={`${shared.panel} ${styles.wide}`} role="dialog" aria-label={view === 'loadout' ? 'Equipamiento' : 'Evoluciones'}>
          <h2 className={shared.title}>{view === 'loadout' ? 'Equipamiento' : 'Evoluciones'}</h2>
          {view === 'loadout' ? (
            <Loadout hud={hud} />
          ) : (
            <>
              <p className={shared.note}>Arma al nivel 7 + su pasiva → abre un cofre. Lo que llevas se ilumina.</p>
              <Evolutions hud={hud} />
            </>
          )}
          <button type="button" className={shared.secondary} onClick={() => setView('menu')}>
            Volver
          </button>
        </div>
      </div>
    );
  return (
    <div className={shared.overlay}>
      <div className={shared.panel} role="dialog" aria-label="Pausa">
        <h2 className={shared.title}>Pausa</h2>
        <button type="button" className={shared.primary} onClick={onResume}>
          <Play /> Continuar
        </button>
        <button type="button" className={shared.secondary} onClick={() => setView('loadout')} disabled={!hud}>
          Ver equipamiento
        </button>
        <button type="button" className={shared.secondary} onClick={() => setView('evolutions')} disabled={!hud}>
          Tabla de evoluciones
        </button>
        <button type="button" className={shared.secondary} onClick={onExit}>
          {final ? 'Salir' : 'Guardar y salir'}
        </button>
        {final && <p className={shared.note}>Ya has pasado el minuto 15: al salir, la partida termina y se guarda su resultado.</p>}
        <p className={shared.note}>
          Muévete con el dedo (o WASD / flechas). El ataque es automático. {hud ? `${hud.fps} fps · ${hud.graphics}` : ''}
        </p>
      </div>
    </div>
  );
}
