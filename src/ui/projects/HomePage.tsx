import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, FolderKanban, Hourglass, Plus } from 'lucide-react';
import type { ProjectStatus } from '../../core/model';
import { today } from '../../core/clock';
import { projectSummariesByStatus } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Fab } from '../components/Fab';
import { MOBILE_QUERY, TOUCH_QUERY, useMediaQuery } from '../components/useMediaQuery';
import { useShortcut } from '../shortcuts/useShortcut';
import { ProjectCard } from './ProjectCard';
import { ProjectFormDialog } from './ProjectFormDialog';
import styles from './HomePage.module.css';

const SECTIONS: { status: ProjectStatus; title: string; emptyIcon: ReactNode; emptyTitle: string; emptyText?: string }[] = [
  {
    status: 'active',
    title: 'Activos',
    emptyIcon: <FolderKanban />,
    emptyTitle: 'Ningún proyecto activo',
    emptyText: 'Crea un proyecto o reactiva uno en espera para empezar a trabajar.',
  },
  {
    status: 'on_hold',
    title: 'En espera',
    emptyIcon: <Hourglass />,
    emptyTitle: 'Nada en espera',
    emptyText: 'Aquí aparecerán los proyectos que quieras empezar más adelante.',
  },
  { status: 'done', title: 'Finalizados', emptyIcon: <Archive />, emptyTitle: 'Aún no has finalizado ningún proyecto' },
];

export function HomePage() {
  const data = useTasky((s) => s.data);
  const [creating, setCreating] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isTouch = useMediaQuery(TOUCH_QUERY);
  useShortcut('p', () => setCreating(true));

  const sections = useMemo(
    () => SECTIONS.map((section) => ({ ...section, summaries: projectSummariesByStatus(data, section.status, today()) })),
    [data],
  );
  const active = sections[0].summaries;
  const pendingTasks = active.reduce((sum, s) => sum + s.pending, 0);
  const isEmpty = sections.every((s) => s.summaries.length === 0);

  return (
    <div className={`${styles.page} ${isMobile ? styles.withFab : ''}`}>
      <div className={styles.intro}>
        <div>
          <h1 className={styles.title}>Proyectos</h1>
          <p className={styles.subtitle}>
            {active.length === 0
              ? `Pulsa ${isTouch ? '+' : 'P'} para crear tu primer proyecto.`
              : `${active.length} ${active.length === 1 ? 'proyecto activo' : 'proyectos activos'} · ${pendingTasks} ${
                  pendingTasks === 1 ? 'tarea pendiente' : 'tareas pendientes'
                }`}
          </p>
        </div>
        {!isMobile && (
          <Button variant="primary" icon={<Plus />} shortcut="P" onClick={() => setCreating(true)}>
            Nuevo proyecto
          </Button>
        )}
      </div>

      {sections.map((section) => {
        const featured = section.status === 'active';
        // Sin proyectos, solo se muestra la sección principal para no llenar la pantalla de vacíos.
        if (isEmpty && !featured) return null;
        return (
          <section key={section.status} className={styles.section} aria-labelledby={`section-${section.status}`}>
            <header className={styles.sectionHeader}>
              <span className={`${styles.sectionDot} ${styles[section.status]}`} />
              <h2 id={`section-${section.status}`} className={styles.sectionTitle}>
                {section.title}
              </h2>
              <span className={styles.sectionCount}>{section.summaries.length}</span>
            </header>

            {section.summaries.length === 0 ? (
              <EmptyState
                compact={!featured}
                icon={section.emptyIcon}
                title={section.emptyTitle}
                description={section.emptyText}
                action={
                  featured && (
                    <Button icon={<Plus />} shortcut="P" onClick={() => setCreating(true)}>
                      Nuevo proyecto
                    </Button>
                  )
                }
              />
            ) : (
              <div className={featured ? styles.gridFeatured : styles.gridCompact}>
                <AnimatePresence initial={false} mode="popLayout">
                  {section.summaries.map((summary) => (
                    <motion.div
                      key={summary.project.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <ProjectCard summary={summary} variant={featured ? 'featured' : 'compact'} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        );
      })}

      {isMobile && <Fab label="Nuevo proyecto" onClick={() => setCreating(true)} />}
      <ProjectFormDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
