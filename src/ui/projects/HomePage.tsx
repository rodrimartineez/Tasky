import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, ChevronRight, FolderKanban, Hourglass, Plus, Telescope } from 'lucide-react';
import type { ProjectStatus } from '../../core/model';
import { today } from '../../core/clock';
import { projectSummariesByStatus, todayTasks } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Fab } from '../components/Fab';
import { MOBILE_QUERY, TOUCH_QUERY, useMediaQuery } from '../components/useMediaQuery';
import { useShortcut } from '../shortcuts/useShortcut';
import { ProjectGrid } from './ProjectGrid';
import { ProjectFormDialog } from './ProjectFormDialog';
import { TodaySection } from './TodaySection';
import styles from './HomePage.module.css';

/** Orden fijo de las secciones de Inicio. */
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
    emptyText: 'Aquí aparecerán los proyectos que hayas pausado.',
  },
  {
    status: 'upcoming',
    title: 'Próximos',
    emptyIcon: <Telescope />,
    emptyTitle: 'Nada previsto',
    emptyText: 'Aquí aparecerán los proyectos que quieras empezar más adelante.',
  },
  { status: 'done', title: 'Finalizados', emptyIcon: <Archive />, emptyTitle: 'Aún no has finalizado ningún proyecto' },
];

/** Secciones plegadas: preferencia visual de cada dispositivo (no se sincroniza). */
const COLLAPSED_KEY = 'tasky-collapsed-sections';

function readCollapsed(): ProjectStatus[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((s): s is ProjectStatus => SECTIONS.some((x) => x.status === s)) : [];
  } catch {
    return [];
  }
}

function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = (key: ProjectStatus) =>
    setCollapsed((current) => {
      const next = current.includes(key) ? current.filter((s) => s !== key) : [...current, key];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // Sin almacenamiento disponible solo se pierde la preferencia al recargar.
      }
      return next;
    });
  return {
    isCollapsed: (key: ProjectStatus) => collapsed.includes(key),
    toggle,
  };
}

interface CollapsibleSectionProps {
  id: ProjectStatus;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function CollapsibleSection({ id, title, count, collapsed, onToggle, children }: CollapsibleSectionProps) {
  const bodyId = `section-body-${id}`;
  return (
    <section className={`${styles.section} ${styles.collapsible}`} aria-labelledby={`section-${id}`}>
      <h2 id={`section-${id}`} className={styles.sectionHeading}>
        <button
          type="button"
          className={styles.sectionToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          title={collapsed ? 'Mostrar sección' : 'Plegar sección'}
          onClick={onToggle}
        >
          <motion.span className={styles.chevron} animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
            <ChevronRight />
          </motion.span>
          <span className={`${styles.sectionDot} ${styles[id]}`} />
          <span className={styles.sectionTitle}>{title}</span>
          <span className={styles.sectionCount}>{count}</span>
        </button>
      </h2>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            id={bodyId}
            className={styles.sectionBody}
            // Recortado solo mientras se pliega o despliega: abierto, las tarjetas pueden sobresalir al pasar el ratón o arrastrarlas.
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            animate={{
              height: 'auto',
              opacity: 1,
              transitionEnd: { overflow: 'visible' },
            }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function HomePage() {
  const data = useTasky((s) => s.data);
  const [creating, setCreating] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isTouch = useMediaQuery(TOUCH_QUERY);
  useShortcut('p', () => setCreating(true));
  const { isCollapsed, toggle } = useCollapsedSections();

  const { sections, todayGroups } = useMemo(() => {
    const day = today();
    return {
      sections: SECTIONS.map((section) => ({ ...section, summaries: projectSummariesByStatus(data, section.status, day) })),
      todayGroups: todayTasks(data, day),
    };
  }, [data]);
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

      {/* «Hoy» solo existe si hay algo para hoy. */}
      {todayGroups.length > 0 && <TodaySection groups={todayGroups} />}

      {sections.map((section) => {
        const featured = section.status === 'active';
        // Sin proyectos, solo se muestra la sección principal para no llenar la pantalla de vacíos.
        if (isEmpty && !featured) return null;
        return (
          <CollapsibleSection
            key={section.status}
            id={section.status}
            title={section.title}
            count={section.summaries.length}
            collapsed={isCollapsed(section.status)}
            onToggle={() => toggle(section.status)}
          >
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
              <ProjectGrid
                summaries={section.summaries}
                variant={featured ? 'featured' : 'compact'}
                className={featured ? styles.gridFeatured : styles.gridCompact}
              />
            )}
          </CollapsibleSection>
        );
      })}

      {isMobile && <Fab label="Nuevo proyecto" onClick={() => setCreating(true)} />}
      <ProjectFormDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
