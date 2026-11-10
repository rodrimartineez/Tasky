import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { TodayGroup } from '../../core/selectors';
import { TIME_SLOT_INFO } from '../tasks/timeSlot';
import { projectColor } from './projectColor';
import home from './HomePage.module.css';
import styles from './TodaySection.module.css';

/** Tareas abiertas programadas para hoy o que vencen hoy, por franja horaria. Solo se muestra si hay alguna. */
export function TodaySection({ groups }: { groups: TodayGroup[] }) {
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <section className={home.section} aria-labelledby="section-today">
      <header className={home.sectionHeader}>
        <span className={`${home.sectionDot} ${home.active}`} />
        <h2 id="section-today" className={home.sectionTitle}>
          Hoy
        </h2>
        <span className={home.sectionCount}>{total}</span>
      </header>

      <div className={styles.groups}>
        {groups.map(({ slot, items }) => (
          <div key={slot} className={styles.group}>
            <h3 className={styles.groupTitle}>
              {TIME_SLOT_INFO[slot].icon}
              {TIME_SLOT_INFO[slot].label}
              <span className={styles.groupCount}>{items.length}</span>
            </h3>
            <ul className={styles.list}>
              {items.map(({ task, project }) => (
                <li key={task.id}>
                  <Link
                    to={`/project/${project.id}`}
                    className={styles.item}
                    style={{ '--project': projectColor(project.id) } as CSSProperties}
                  >
                    <span className={styles.dot} aria-hidden />
                    <span className={styles.title}>{task.title}</span>
                    {task.status === 'in_progress' && <span className={styles.progress}>En curso</span>}
                    <span className={styles.project}>{project.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
