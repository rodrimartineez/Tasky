import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Ellipsis, Lightbulb, ListTodo, Pencil, Trash2 } from 'lucide-react';
import { countProjectItems, findProject } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Kbd } from '../components/Kbd';
import { Menu } from '../components/Menu';
import { useShortcut } from '../shortcuts/useShortcut';
import { ProjectFormDialog } from './ProjectFormDialog';
import { StatusSelector } from './StatusSelector';
import styles from './ProjectPage.module.css';

type Tab = 'tasks' | 'ideas';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const data = useTasky((s) => s.data);
  const updateProject = useTasky((s) => s.updateProject);
  const deleteProject = useTasky((s) => s.deleteProject);
  const [tab, setTab] = useState<Tab>('tasks');
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useShortcut('Escape', () => navigate('/'));

  const project = findProject(data, projectId);
  if (!project) return <Navigate to="/" replace />;
  const counts = countProjectItems(data, project.id);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'tasks', label: 'Tareas', icon: <ListTodo />, count: counts.tasks },
    { id: 'ideas', label: 'Ideas', icon: <Lightbulb />, count: counts.ideas },
  ];

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        <ArrowLeft /> Proyectos <Kbd>Esc</Kbd>
      </Link>

      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{project.name}</h1>
          {project.description && <p className={styles.description}>{project.description}</p>}
        </div>
        <div className={styles.actions}>
          <StatusSelector value={project.status} onChange={(status) => updateProject(project.id, { status })} />
          <Menu
            label="Acciones del proyecto"
            trigger={<Ellipsis />}
            items={[
              { label: 'Editar', icon: <Pencil />, onSelect: () => setEditing(true) },
              { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => setConfirmingDelete(true) },
            ]}
          />
        </div>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Contenido del proyecto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabSelected : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
            <span className={styles.tabCount}>{t.count}</span>
            {tab === t.id && <motion.span layoutId="tab-underline" className={styles.underline} />}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {tab === 'tasks' ? (
          <EmptyState icon={<ListTodo />} title="Sin tareas todavía" description="Las tareas marcan la secuencia de trabajo del proyecto." />
        ) : (
          <EmptyState icon={<Lightbulb />} title="Sin ideas todavía" description="Guarda aquí conceptos y posibilidades para más adelante." />
        )}
      </div>

      <ProjectFormDialog open={editing} onClose={() => setEditing(false)} project={project} />
      <ConfirmDialog
        open={confirmingDelete}
        title={`¿Eliminar «${project.name}»?`}
        description={
          counts.tasks + counts.ideas > 0
            ? `También se eliminarán sus ${counts.tasks} tareas y ${counts.ideas} ideas. Esta acción no se puede deshacer.`
            : 'Esta acción no se puede deshacer.'
        }
        confirmLabel="Eliminar proyecto"
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          deleteProject(project.id);
          navigate('/');
        }}
      />
    </div>
  );
}
