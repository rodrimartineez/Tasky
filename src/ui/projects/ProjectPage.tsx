import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Ellipsis, Layers, Lightbulb, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Idea, Phase, Task } from '../../core/model';
import { countProjectItems, findPhase, findProject } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Fab } from '../components/Fab';
import { toast } from '../components/Toaster';
import { Kbd } from '../components/Kbd';
import { Menu } from '../components/Menu';
import { Segmented } from '../components/Segmented';
import { PROJECT_STATUS_OPTIONS } from '../components/StatusBadge';
import { MOBILE_QUERY, useMediaQuery } from '../components/useMediaQuery';
import { useShortcut } from '../shortcuts/useShortcut';
import { IdeaDetailDialog } from '../ideas/IdeaDetailDialog';
import { IdeaFormDialog } from '../ideas/IdeaFormDialog';
import { IdeaGrid } from '../ideas/IdeaGrid';
import { PhaseFormDialog } from '../phases/PhaseFormDialog';
import { TaskDetailDialog } from '../tasks/TaskDetailDialog';
import { TaskFormDialog } from '../tasks/TaskFormDialog';
import { TaskList } from '../tasks/TaskList';
import { ProjectFormDialog } from './ProjectFormDialog';
import styles from './ProjectPage.module.css';

type Tab = 'tasks' | 'ideas';

export function ProjectPage() {
  /** Con `phaseId` se muestra la vista de esa fase: sus tareas, sin pestañas. */
  const { projectId = '', phaseId } = useParams();
  const navigate = useNavigate();
  const data = useTasky((s) => s.data);
  const updateProject = useTasky((s) => s.updateProject);
  const deleteProject = useTasky((s) => s.deleteProject);
  const deleteTask = useTasky((s) => s.deleteTask);
  const deleteIdea = useTasky((s) => s.deleteIdea);
  const deletePhase = useTasky((s) => s.deletePhase);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [tab, setTab] = useState<Tab>('tasks');
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** Diálogo de tarea: null = cerrado; { task: undefined } = nueva tarea. */
  const [taskDialog, setTaskDialog] = useState<{ task?: Task } | null>(null);
  const newTask = () => {
    setTab('tasks');
    setTaskDialog({});
  };
  useShortcut('Escape', () => navigate(phaseId ? `/project/${projectId}` : '/'));
  /** Diálogo de fase: null = cerrado; { phase: undefined } = nueva fase. */
  const [phaseDialog, setPhaseDialog] = useState<{ phase?: Phase } | null>(null);
  const newPhase = () => {
    setTab('tasks');
    setPhaseDialog({});
  };
  /** Diálogo de idea: null = cerrado; { idea: undefined } = nueva idea. */
  const [ideaDialog, setIdeaDialog] = useState<{ idea?: Idea } | null>(null);
  const newIdea = () => {
    setTab('ideas');
    setIdeaDialog({});
  };
  useShortcut('t', newTask);
  useShortcut('i', newIdea, !phaseId);
  useShortcut('f', newPhase, !phaseId);
  // Detalle: se guarda el id para mostrar siempre la versión actual (también si cambia en otro dispositivo).
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [ideaDetailId, setIdeaDetailId] = useState<string | null>(null);
  /** Confirmación de borrado desde el menú «···». */
  const [pendingDelete, setPendingDelete] = useState<{ title: string; description: string; confirmLabel: string; run: () => void } | null>(
    null,
  );

  const project = findProject(data, projectId);
  if (!project) return <Navigate to="/" replace />;
  const phase = phaseId ? findPhase(data, phaseId) : undefined;
  if (phaseId && phase?.projectId !== project.id) return <Navigate to={`/project/${project.id}`} replace />;
  const counts = countProjectItems(data, project.id);
  const detailTask = data.tasks.find((t) => t.id === taskDetailId && !t.deletedAt);
  const detailIdea = data.ideas.find((i) => i.id === ideaDetailId && !i.deletedAt);

  const editTask = (task: Task) => {
    setTaskDetailId(null);
    setTaskDialog({ task });
  };
  const editIdea = (idea: Idea) => {
    setIdeaDetailId(null);
    setIdeaDialog({ idea });
  };
  const confirmDeleteTask = (task: Task) =>
    setPendingDelete({
      title: '¿Eliminar esta tarea?',
      description: `«${task.title}» se eliminará definitivamente.`,
      confirmLabel: 'Eliminar tarea',
      run: () => {
        deleteTask(task.id);
        toast('Tarea eliminada.');
      },
    });
  const confirmDeletePhase = (target: Phase) =>
    setPendingDelete({
      title: '¿Eliminar esta fase?',
      description: `Se eliminará «${target.name}». Sus tareas no se borran: quedan en el proyecto, sin fase.`,
      confirmLabel: 'Eliminar fase',
      run: () => {
        deletePhase(target.id);
        if (phase?.id === target.id) navigate(`/project/${project.id}`);
        toast('Fase eliminada.');
      },
    });
  const confirmDeleteIdea = (idea: Idea) =>
    setPendingDelete({
      title: '¿Eliminar esta idea?',
      description: `«${idea.title}» se eliminará definitivamente.`,
      confirmLabel: 'Eliminar idea',
      run: () => {
        deleteIdea(idea.id);
        toast('Idea eliminada.');
      },
    });

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'tasks', label: 'Tareas', icon: <ListTodo />, count: counts.tasks },
    { id: 'ideas', label: 'Ideas', icon: <Lightbulb />, count: counts.ideas },
  ];

  const tabButtons = tabs.map((t) => (
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
      {tab === t.id && <motion.span layoutId="tab-indicator" className={isMobile ? styles.pill : styles.underline} />}
    </button>
  ));

  return (
    <div className={`${styles.page} ${isMobile && !phase ? styles.withBottomBar : ''}`}>
      {phase ? (
        <Link to={`/project/${project.id}`} className={styles.back}>
          <ArrowLeft /> {project.name} <Kbd>Esc</Kbd>
        </Link>
      ) : (
        <Link to="/" className={styles.back}>
          <ArrowLeft /> Proyectos <Kbd>Esc</Kbd>
        </Link>
      )}

      {phase ? (
        <header className={styles.header}>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>
              <Layers /> Fase
            </p>
            <h1 className={styles.title}>{phase.name}</h1>
            {phase.description && <p className={styles.description}>{phase.description}</p>}
          </div>
          <div className={styles.actions}>
            {!isMobile && (
              <Button variant="primary" icon={<Plus />} shortcut="T" onClick={newTask}>
                Nueva tarea
              </Button>
            )}
            <Menu
              label="Acciones de la fase"
              trigger={<Ellipsis />}
              items={[
                { label: 'Editar', icon: <Pencil />, onSelect: () => setPhaseDialog({ phase }) },
                { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => confirmDeletePhase(phase) },
              ]}
            />
          </div>
        </header>
      ) : (
        <header className={styles.header}>
          <div className={styles.heading}>
            <h1 className={styles.title}>{project.name}</h1>
            {project.description && <p className={styles.description}>{project.description}</p>}
          </div>
          <div className={styles.actions}>
            <Segmented
              label="Estado del proyecto"
              value={project.status}
              options={PROJECT_STATUS_OPTIONS}
              onChange={(status) => updateProject(project.id, { status })}
            />
            <Menu
              label="Acciones del proyecto"
              trigger={<Ellipsis />}
              items={[
                { label: 'Nueva fase', icon: <Layers />, onSelect: newPhase },
                { label: 'Editar', icon: <Pencil />, onSelect: () => setEditing(true) },
                { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => setConfirmingDelete(true) },
              ]}
            />
          </div>
        </header>
      )}

      {phase ? null : isMobile ? (
        // Móvil: las pestañas pasan a una barra inferior (montada en body para que quede fija a la pantalla)
        // y «Nueva tarea/idea» al botón «+».
        createPortal(
          <nav className={styles.bottomBar} role="tablist" aria-label="Contenido del proyecto">
            {tabButtons}
          </nav>,
          document.body,
        )
      ) : (
        <nav className={styles.tabs} role="tablist" aria-label="Contenido del proyecto">
          {tabButtons}
          <span className={styles.tabsSpacer} />
          {tab === 'tasks' ? (
            <>
              <Button icon={<Layers />} shortcut="F" className={styles.tabAction} onClick={newPhase}>
                Nueva fase
              </Button>
              <Button variant="primary" icon={<Plus />} shortcut="T" className={styles.tabAction} onClick={newTask}>
                Nueva tarea
              </Button>
            </>
          ) : (
            <Button icon={<Plus />} shortcut="I" className={styles.tabAction} onClick={newIdea}>
              Nueva idea
            </Button>
          )}
        </nav>
      )}

      <div role={phase ? undefined : 'tabpanel'}>
        {tab === 'tasks' || phase ? (
          <TaskList
            key={phase?.id ?? 'project'}
            projectId={project.id}
            phaseId={phase?.id}
            onCreate={newTask}
            onOpen={(task) => setTaskDetailId(task.id)}
            onEdit={editTask}
            onDelete={confirmDeleteTask}
            onEditPhase={(target) => setPhaseDialog({ phase: target })}
            onDeletePhase={confirmDeletePhase}
          />
        ) : (
          <IdeaGrid
            projectId={project.id}
            onCreate={newIdea}
            onOpen={(idea) => setIdeaDetailId(idea.id)}
            onEdit={editIdea}
            onDelete={confirmDeleteIdea}
          />
        )}
      </div>

      {isMobile && (
        <Fab
          aboveBar={!phase}
          label={tab === 'tasks' || phase ? 'Nueva tarea' : 'Nueva idea'}
          onClick={tab === 'tasks' || phase ? newTask : newIdea}
        />
      )}

      <TaskDetailDialog task={detailTask} project={project} onClose={() => setTaskDetailId(null)} onEdit={editTask} />
      <IdeaDetailDialog idea={detailIdea} project={project} onClose={() => setIdeaDetailId(null)} onEdit={editIdea} />
      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.title ?? ''}
        description={pendingDelete?.description ?? ''}
        confirmLabel={pendingDelete?.confirmLabel ?? ''}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          pendingDelete?.run();
          setPendingDelete(null);
        }}
      />
      <TaskFormDialog
        open={taskDialog !== null}
        onClose={() => setTaskDialog(null)}
        projectId={project.id}
        task={taskDialog?.task}
        phaseId={phase?.id}
      />
      <PhaseFormDialog open={phaseDialog !== null} onClose={() => setPhaseDialog(null)} projectId={project.id} phase={phaseDialog?.phase} />
      <IdeaFormDialog open={ideaDialog !== null} onClose={() => setIdeaDialog(null)} projectId={project.id} idea={ideaDialog?.idea} />
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
