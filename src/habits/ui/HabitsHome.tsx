import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '../../ui/components/Button';
import { Fab } from '../../ui/components/Fab';
import { useMediaQuery } from '../../ui/components/useMediaQuery';
import { HabitBridge } from './HabitBridge';
import { HabitCard } from './HabitCard';
import { HabitFormDialog } from './HabitFormDialog';
import { SwordIcon } from './icons';
import { useHabitViews, type HabitView } from './view';
import styles from './HabitsHome.module.css';

const daysLeftLabel = (n: number) => (n === 0 ? 'se cierra hoy' : n === 1 ? 'queda 1 día' : `quedan ${n} días`);

export function HabitsHome() {
  const views = useHabitViews();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const isMobile = useMediaQuery('(max-width: 640px)');

  const activeViews = views.filter((v) => v.habit.archivedAt === null);
  const daily = activeViews.filter((v) => v.habit.period === 'daily');
  const weekly = activeViews.filter((v) => v.habit.period === 'weekly');
  const archived = views.filter((v) => v.habit.archivedAt !== null);
  const dailyDone = daily.filter((v) => v.met).length;

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <div>
          <h1 className={styles.title}>Tus hábitos</h1>
          <p className={styles.subtitle}>Cada hábito cumplido da puntos para mejorar a tu personaje.</p>
        </div>
        {!isMobile && (
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
            Nuevo hábito
          </Button>
        )}
      </div>

      {activeViews.length === 0 ? (
        <div className={styles.empty}>
          <SwordIcon size={40} />
          <p className={styles.emptyTitle}>Empieza tu aventura</p>
          <p className={styles.emptyText}>
            Crea un hábito para hacer más (leer, caminar…) o uno para hacer menos (mirar el móvil…). Cada día cumplido da puntos para
            mejorar a tu personaje, y más cuanto más larga sea la racha.
          </p>
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
            Crear el primer hábito
          </Button>
        </div>
      ) : (
        <>
          <HabitBridge />
          {daily.length > 0 && (
            <Section title="Hoy" meta={`${dailyDone}/${daily.length} cumplidos`} views={daily} />
          )}
          {weekly.length > 0 && <Section title="Esta semana" meta={daysLeftLabel(weekly[0].daysLeft)} views={weekly} />}
        </>
      )}

      {archived.length > 0 && (
        <section className={styles.section}>
          <button type="button" className={styles.archivedToggle} onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            <ChevronRight className={showArchived ? styles.open : ''} /> Archivados ({archived.length})
          </button>
          {showArchived && (
            <div className={styles.list}>
              {archived.map((v) => (
                <HabitCard key={v.habit.id} view={v} />
              ))}
            </div>
          )}
        </section>
      )}

      {isMobile && <Fab label="Nuevo hábito" onClick={() => setCreating(true)} />}
      <HabitFormDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function Section({ title, meta, views }: { title: string; meta: string; views: HabitView[] }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.sectionMeta}>{meta}</span>
      </header>
      <div className={styles.list}>
        <AnimatePresence initial={false}>
          {views.map((v) => (
            <HabitCard key={v.habit.id} view={v} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
