import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Ellipsis, Lightbulb, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Idea, ProjectStatus, Task } from '../../core/model';
import { countProjectItems, findProject } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Kbd } from '../components/Kbd';
import { Menu } from '../components/Menu';
import { Segmented, type SegmentedOption } from '../components/Segmented';
import { PROJECT_STATUS_LABEL } from '../components/StatusBadge';
import { useShortcut } from '../shortcuts/useShortcut';
import { IdeaFormDialog } from '../ideas/IdeaFormDialog';
import { IdeaGrid } from '../ideas/IdeaGrid';
import { TaskFormDialog } from '../tasks/TaskFormDialog';
import { TaskList } from '../tasks/TaskList';
import { ProjectFormDialog } from './ProjectFormDialog';
import styles from './ProjectPage.module.css';

type Tab = 'tasks' | 'ideas';

const STATUS_OPTIONS: SegmentedOption<ProjectStatus>[] = [
  { value: 'active', label: PROJECT_STATUS_LABEL.active, color: 'var(--status-active)' },
  { value: 'on_hold', label: PROJECT_STATUS_LABEL.on_hold, color: 'var(--status-on-hold)' },
  { value: 'done', label: PROJECT_STATUS_LABEL.done, color: 'var(--status-done)' },
];

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const data = useTasky((s) => s.data);
  const updateProject = useTasky((s) => s.updateProject);
  const deleteProject = useTasky((s) => s.deleteProject);
  const [tab, setTab] = useState<Tab>('tasks');
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** Diálogo de tarea: null = cerrado; { task: undefined } = nueva tarea. */
  const [taskDialog, setTaskDialog] = useState<{ task?: Task } | null>(null);
  const newTask = () => {
    setTab('tasks');
    setTaskDialog({});
  };
  useShortcut('Escape', () => navigate('/'));
  /** Diálogo de idea: null = cerrado; { idea: undefined } = nueva idea. */
  const [ideaDialog, setIdeaDialog] = useState<{ idea?: Idea } | null>(null);
  const newIdea = () => {
    setTab('ideas');
    setIdeaDialog({});
  };
  useShortcut('t', newTask);
  useShortcut('i', newIdea);

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
          <Segmented
            label="Estado del proyecto"
            value={project.status}
            options={STATUS_OPTIONS}
            onChange={(status) => updateProject(project.id, { status })}
          />
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
            tabIndex={tab === t.id ? 0 : -1}
            onKeyDown={(e) => {
              // Patrón de pestañas: las flechas cambian de pestaña.
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              const next = tab === 'tasks' ? 'ideas' : 'tasks';
              setTab(next);
              (e.currentTarget.parentElement?.querySelector(`[data-tab="${next}"]`) as HTMLElement | null)?.focus();
            }}
            data-tab={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabSelected : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
            <span className={styles.tabCount}>{t.count}</span>
            {tab === t.id && <motion.span layoutId="tab-underline" className={styles.underline} />}
          </button>
        ))}
        <span className={styles.tabsSpacer} />
        {tab === 'tasks' ? (
          <Button variant="primary" icon={<Plus />} shortcut="T" className={styles.tabAction} onClick={newTask}>
            Nueva tarea
          </Button>
        ) : (
          <Button icon={<Plus />} shortcut="I" className={styles.tabAction} onClick={newIdea}>
            Nueva idea
          </Button>
        )}
      </nav>

      <div role="tabpanel">
        {tab === 'tasks' ? (
          <TaskList projectId={project.id} onCreate={newTask} onOpen={(task) => setTaskDialog({ task })} />
        ) : (
          <IdeaGrid projectId={project.id} onCreate={newIdea} onOpen={(idea) => setIdeaDialog({ idea })} />
        )}
      </div>

      <TaskFormDialog
        open={taskDialog !== null}
        onClose={() => setTaskDialog(null)}
        projectId={project.id}
        task={taskDialog?.task}
      />
      <IdeaFormDialog
        open={ideaDialog !== null}
        onClose={() => setIdeaDialog(null)}
        projectId={project.id}
        idea={ideaDialog?.idea}
      />
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
