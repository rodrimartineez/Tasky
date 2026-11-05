import type { ReactNode } from 'react';
import { FolderKanban, Hourglass, Plus, Archive } from 'lucide-react';
import type { ProjectStatus, TaskyData } from '../../core/model';
import { projectSummariesByStatus } from '../../core/selectors';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ProjectCard } from './ProjectCard';
import styles from './HomePage.module.css';

interface HomePageProps {
  data: TaskyData;
  onCreateProject: () => void;
}

const SECTIONS: { status: ProjectStatus; title: string; emptyIcon: ReactNode; emptyTitle: string; emptyText: string }[] = [
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
  {
    status: 'done',
    title: 'Finalizados',
    emptyIcon: <Archive />,
    emptyTitle: 'Aún no has finalizado ningún proyecto',
    emptyText: '',
  },
];

export function HomePage({ data, onCreateProject }: HomePageProps) {
  const active = projectSummariesByStatus(data, 'active');
  const pendingTasks = active.reduce((sum, s) => sum + s.pending, 0);

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <div>
          <h1 className={styles.title}>Proyectos</h1>
          <p className={styles.subtitle}>
            {active.length === 0
              ? 'Empieza creando tu primer proyecto.'
              : `${active.length} ${active.length === 1 ? 'proyecto activo' : 'proyectos activos'} · ${pendingTasks} ${
                  pendingTasks === 1 ? 'tarea pendiente' : 'tareas pendientes'
                }`}
          </p>
        </div>
        <Button variant="primary" icon={<Plus />} shortcut="N" onClick={onCreateProject}>
          Nuevo proyecto
        </Button>
      </div>

      {SECTIONS.map((section) => {
        const summaries = section.status === 'active' ? active : projectSummariesByStatus(data, section.status);
        const featured = section.status === 'active';
        return (
          <section key={section.status} className={styles.section} aria-labelledby={`section-${section.status}`}>
            <header className={styles.sectionHeader}>
              <span className={`${styles.sectionDot} ${styles[section.status]}`} />
              <h2 id={`section-${section.status}`} className={styles.sectionTitle}>
                {section.title}
              </h2>
              <span className={styles.sectionCount}>{summaries.length}</span>
            </header>

            {summaries.length === 0 ? (
              <EmptyState
                compact={!featured}
                icon={section.emptyIcon}
                title={section.emptyTitle}
                description={section.emptyText || undefined}
                action={
                  featured ? (
                    <Button variant="secondary" icon={<Plus />} onClick={onCreateProject}>
                      Nuevo proyecto
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className={featured ? styles.gridFeatured : styles.gridCompact}>
                {summaries.map((summary) => (
                  <ProjectCard key={summary.project.id} summary={summary} variant={featured ? 'featured' : 'compact'} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
