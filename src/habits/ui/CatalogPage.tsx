import { useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { evolutionEntries, passiveEntries, WEAPON_FIGURE_LABELS, weaponEntries, type WeaponFigures } from '../../game/content/catalog';
import { spriteDataUrl } from '../../game/sprites/atlas';
import styles from './CatalogPage.module.css';

type Tab = 'weapons' | 'passives' | 'evolutions';

const Icon = ({ name, size = 36 }: { name: string; size?: number }) => (
  <img className={styles.icon} src={spriteDataUrl(name)} alt="" width={size} height={size} draggable={false} />
);

/** Tabla «antes → después» de los valores principales de un arma. */
function Figures({ from, to, fromLabel, toLabel }: { from: WeaponFigures; to: WeaponFigures; fromLabel: string; toLabel: string }) {
  return (
    <table className={styles.figures}>
      <thead>
        <tr>
          <th />
          <th>{fromLabel}</th>
          <th>{toLabel}</th>
        </tr>
      </thead>
      <tbody>
        {(Object.keys(WEAPON_FIGURE_LABELS) as (keyof WeaponFigures)[]).map((k) => (
          <tr key={k}>
            <th scope="row">{WEAPON_FIGURE_LABELS[k]}</th>
            <td>{from[k]}</td>
            <td className={from[k] !== to[k] ? styles.changed : undefined}>{to[k]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Las definiciones no cambian durante la ejecución: se calcula una vez al cargar el apartado.
const WEAPON_ENTRIES = weaponEntries();
const PASSIVE_ENTRIES = passiveEntries();
const EVOLUTION_ENTRIES = evolutionEntries();

/** Catálogo completo de armas, pasivas y evoluciones, generado desde las definiciones del juego (content/catalog.ts). */
export function CatalogPage() {
  const [tab, setTab] = useState<Tab>('weapons');
  const weapons = WEAPON_ENTRIES;
  const passives = PASSIVE_ENTRIES;
  const evolutions = EVOLUTION_ENTRIES;
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'weapons', label: 'Armas', count: weapons.length },
    { id: 'passives', label: 'Pasivas', count: passives.length },
    { id: 'evolutions', label: 'Evoluciones', count: evolutions.length },
  ];

  return (
    <div className={styles.page}>
      <p className={styles.intro}>
        Todo lo que puede aparecer en una partida, lo hayas usado o no. Las armas y pasivas se eligen al subir de nivel; las evoluciones
        aparecen al abrir un cofre con el arma al nivel máximo y su pasiva.
      </p>
      <div className={styles.tabs} role="tablist" aria-label="Secciones del catálogo">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label} <span className={styles.count}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'weapons' && (
        <ul className={styles.list} role="tabpanel" aria-label="Armas">
          {weapons.map((w) => (
            <li key={w.def.id} className={styles.card}>
              <div className={styles.head}>
                <Icon name={w.def.icon} />
                <div className={styles.titles}>
                  <h2 className={styles.name}>{w.def.name}</h2>
                  <span className={styles.tag}>{w.attack}</span>
                </div>
              </div>
              <p className={styles.text}>{w.def.description}</p>
              <Figures from={w.first} to={w.last} fromLabel="Nivel 1" toLabel={`Nivel ${w.maxLevel}`} />
              <details className={styles.details}>
                <summary>Mejoras por nivel</summary>
                <ol className={styles.levels}>
                  {w.levels.map((l) => (
                    <li key={l.level}>
                      <b>Nv {l.level}</b> {l.text}
                    </li>
                  ))}
                </ol>
              </details>
              {w.evolutions.map((e) => (
                <p key={e.def.id} className={styles.evolves}>
                  Evoluciona en <b>{e.def.name}</b> con {passives.find((p) => p.def.id === e.passive)?.def.name}.
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}

      {tab === 'passives' && (
        <ul className={styles.list} role="tabpanel" aria-label="Pasivas">
          {passives.map((p) => (
            <li key={p.def.id} className={styles.card}>
              <div className={styles.head}>
                <Icon name={p.def.icon} />
                <div className={styles.titles}>
                  <h2 className={styles.name}>{p.def.name}</h2>
                  <span className={styles.tag}>Hasta nivel {p.def.maxLevel}</span>
                </div>
              </div>
              <p className={styles.text}>{p.def.text} por nivel.</p>
              <table className={styles.figures}>
                <thead>
                  <tr>
                    <th />
                    <th>Por nivel</th>
                    <th>Nivel {p.def.maxLevel}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.changes.map((c) => (
                    <tr key={c.stat}>
                      <th scope="row">{c.label}</th>
                      <td>{c.perLevel}</td>
                      <td className={styles.changed}>{c.atMax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {p.evolutions.length > 0 && (
                <p className={styles.evolves}>Necesaria para: {p.evolutions.map((e) => e.def.name).join(', ')}.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === 'evolutions' && (
        <ul className={styles.list} role="tabpanel" aria-label="Evoluciones">
          {evolutions.map((e) => (
            <li key={e.evolution.def.id} className={`${styles.card} ${styles.evolution}`}>
              <div className={styles.head}>
                <Icon name={e.evolution.def.icon} size={44} />
                <div className={styles.titles}>
                  <h2 className={styles.name}>{e.evolution.def.name}</h2>
                  <span className={styles.tag}>{e.attack}</span>
                </div>
              </div>
              <div className={styles.recipe} aria-label={`${e.weapon.name} al nivel máximo más ${e.passive.name}`}>
                <span className={styles.ingredient}>
                  <Icon name={e.weapon.icon} size={28} /> {e.weapon.name} <small>nivel {e.weapon.levels.length + 1}</small>
                </span>
                <Plus className={styles.op} />
                <span className={styles.ingredient}>
                  <Icon name={e.passive.icon} size={28} /> {e.passive.name}
                </span>
                <ArrowRight className={styles.op} />
                <span className={styles.ingredient}>
                  <Icon name={e.evolution.def.icon} size={28} /> {e.evolution.def.name}
                </span>
              </div>
              <p className={styles.text}>{e.evolution.def.description}</p>
              <Figures from={e.before} to={e.after} fromLabel={`${e.weapon.name} (máx.)`} toLabel="Evolución" />
              <p className={styles.evolves}>Ocupa el mismo hueco que el arma y ya no sube de nivel.</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
