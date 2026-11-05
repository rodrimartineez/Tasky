import { Fragment } from 'react';
import { Dialog } from '../components/Dialog';
import { Kbd } from '../components/Kbd';
import { SHORTCUT_GROUPS } from './shortcuts';
import styles from './ShortcutsHelp.module.css';

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Atajos de teclado" description="Funcionan siempre que no estés escribiendo en un campo.">
      <div className={styles.groups}>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            <ul className={styles.list}>
              {group.items.map((item) => (
                <li key={item.label} className={styles.row}>
                  <span>{item.label}</span>
                  <span className={styles.keys}>
                    {item.keys.map((k, i) => (
                      <Fragment key={k}>
                        {i > 0 && <span className={styles.plus}>+</span>}
                        <Kbd>{k}</Kbd>
                      </Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
