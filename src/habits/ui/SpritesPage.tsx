import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SPRITES } from '../../game/sprites/data';
import { spriteDataUrl } from '../../game/sprites/atlas';
import styles from './SpritesPage.module.css';

/** Grupos por prefijo del nombre del sprite (game/sprites). */
const GROUPS: { prefix: RegExp; title: string }[] = [
  { prefix: /^(hero_|c_)/, title: 'Personajes' },
  { prefix: /^e_/, title: 'Enemigos y jefes' },
  { prefix: /^w_/, title: 'Armas y evoluciones (iconos)' },
  { prefix: /^x_/, title: 'Proyectiles' },
  { prefix: /^fx_/, title: 'Efectos' },
  { prefix: /^p_/, title: 'Pasivas' },
  { prefix: /^u_/, title: 'Mejoras permanentes' },
  { prefix: /^i_/, title: 'Objetos y recogidas' },
  { prefix: /^d_/, title: 'Mapas (adornos)' },
  { prefix: /^n\d$/, title: 'Números' },
];

const ZOOMS = [2, 4, 6];

/** Herramienta de desarrollo: todos los sprites del juego para revisarlos de un vistazo. */
export function SpritesPage() {
  const [zoom, setZoom] = useState(4);
  const [filter, setFilter] = useState('');
  const groups = useMemo(() => {
    const names = Object.keys(SPRITES).filter((n) => n.includes(filter.trim()));
    const used = new Set<string>();
    const out = GROUPS.map((g) => {
      const items = names.filter((n) => !used.has(n) && g.prefix.test(n)).sort();
      items.forEach((n) => used.add(n));
      return { title: g.title, items };
    });
    out.push({ title: 'Otros', items: names.filter((n) => !used.has(n)).sort() });
    return out.filter((g) => g.items.length > 0);
  }, [filter]);

  return (
    <div className={styles.page}>
      <p className={styles.intro}>
        Todos los sprites del juego ({Object.keys(SPRITES).length}). <Link to="/habits/catalog">Volver al catálogo</Link>
      </p>
      <div className={styles.controls}>
        <input
          className={styles.filter}
          type="search"
          placeholder="Filtrar por nombre (p. ej. e_ o spark)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {ZOOMS.map((z) => (
          <button key={z} type="button" className={z === zoom ? styles.on : ''} aria-pressed={z === zoom} onClick={() => setZoom(z)}>
            ×{z}
          </button>
        ))}
      </div>
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className={styles.title}>
            {g.title} <span>{g.items.length}</span>
          </h2>
          <ul className={styles.grid}>
            {g.items.map((name) => {
              const rows = SPRITES[name];
              return (
                <li key={name} className={styles.item}>
                  <img
                    src={spriteDataUrl(name)}
                    alt=""
                    width={rows[0].length * zoom}
                    height={rows.length * zoom}
                    className={styles.sprite}
                    draggable={false}
                  />
                  <code>{name}</code>
                  <small>
                    {rows[0].length}×{rows.length}
                  </small>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
