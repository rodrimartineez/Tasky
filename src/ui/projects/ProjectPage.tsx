import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Ellipsis, FolderOpen, Layers, Lightbulb, ListTodo, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import type { Idea, Phase, ProjectGroup, Task } from '../../core/model';
import { countProjectItems, findPhase, findProject, findProjectGroup, phaseGroup } from '../../core/selectors';
import { usePeople } from '../../state/people';
import { useTasky } from '../../state/store';
import { AvatarStack } from '../collab/Avatar';
import { ShareDialog } from '../collab/ShareDialog';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Fab } from '../components/Fab';
import { toast } from '../components/Toaster';
import { Kbd } from '../components/Kbd';
import { Menu } from '../components/Menu';
import { RichText } from '../components/RichText';
import { useLongPressMenu } from '../components/useLongPressMenu';
import { Segmented } from '../components/Segmented';
import { PROJECT_STATUS_OPTIONS } from '../components/StatusBadge';
import { MOBILE_QUERY, useMediaQuery } from '../components/useMediaQuery';
import { useShortcut } from '../shortcuts/useShortcut';
import { IdeaDetailDialog } from '../ideas/IdeaDetailDialog';
import { IdeaFormDialog } from '../ideas/IdeaFormDialog';
import { IdeaGrid } from '../ideas/IdeaGrid';
import { GroupFormDialog } from '../phases/GroupFormDialog';
import { PhaseFormDialog } from '../phases/PhaseFormDialog';
import { TaskDetailDialog } from '../tasks/TaskDetailDialog';
import { TaskFormDialog } from '../tasks/TaskFormDialog';
import { TaskList } from '../tasks/TaskList';
import { ProjectFormDialog } from './ProjectFormDialog';
import styles from './ProjectPage.module.css';

type Tab = 'tasks' | 'ideas';

export function ProjectPage() {
  /** Con `phaseId` se muestra la vista de esa fase (sus tareas); con `groupId`, la de ese grupo (sus fases). Sin pestañas. */
  const { projectId = '', phaseId, groupId } = useParams();
  const navigate = useNavigate();
  const data = useTasky((s) => s.data);
  const updateProject = useTasky((s) => s.updateProject);
  const deleteProject = useTasky((s) => s.deleteProject);
  const deleteTask = useTasky((s) => s.deleteTask);
  const deleteIdea = useTasky((s) => s.deleteIdea);
  const deletePhase = useTasky((s) => s.deletePhase);
  const deleteProjectGroup = useTasky((s) => s.deleteProjectGroup);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { menu: headerMenu, press: headerPress } = useLongPressMenu();
  const [tab, setTab] = useState<Tab>('tasks');
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const people = usePeople((s) => s.shares.project[projectId]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** Diálogo de tarea: null = cerrado; { task: undefined } = nueva tarea. */
  const [taskDialog, setTaskDialog] = useState<{ task?: Task } | null>(null);
  const newTask = () => {
    setTab('tasks');
    setTaskDialog({});
  };
  /** Adónde vuelve «Esc» y el enlace superior: de una fase a su grupo (o al proyecto), de un grupo al proyecto. */
  const parentPath = () => {
    const parent = phaseId ? findPhase(data, phaseId) : undefined;
    const parentGroup = parent ? phaseGroup(data, parent) : undefined;
    if (parentGroup) return `/project/${projectId}/group/${parentGroup.id}`;
    return phaseId || groupId ? `/project/${projectId}` : '/';
  };
  useShortcut('Escape', () => navigate(parentPath()));
  /** Diálogo de fase: null = cerrado; { phase: undefined } = nueva fase. */
  const [phaseDialog, setPhaseDialog] = useState<{ phase?: Phase } | null>(null);
  const newPhase = () => {
    setTab('tasks');
    setPhaseDialog({});
  };
  /** Diálogo de grupo: null = cerrado; { group: undefined } = nuevo grupo. */
  const [groupDialog, setGroupDialog] = useState<{ group?: ProjectGroup } | null>(null);
  const newGroup = () => {
    setTab('tasks');
    setGroupDialog({});
  };
  /** Diálogo de idea: null = cerrado; { idea: undefined } = nueva idea. */
  const [ideaDialog, setIdeaDialog] = useState<{ idea?: Idea } | null>(null);
  const newIdea = () => {
    setTab('ideas');
    setIdeaDialog({});
  };
  useShortcut('t', newTask);
  useShortcut('i', newIdea, !phaseId && !groupId);
  useShortcut('f', newPhase, !phaseId);
  useShortcut('g', newGroup, !phaseId && !groupId);
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
  const group = groupId ? findProjectGroup(data, groupId) : undefined;
  if (groupId && group?.projectId !== project.id) return <Navigate to={`/project/${project.id}`} replace />;
  const parentGroup = phase ? phaseGroup(data, phase) : undefined;
  /** Vista de una fase o un grupo: sin pestañas ni ideas. */
  const nested = Boolean(phase || group);
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
        if (phase?.id === target.id) navigate(parentPath());
        toast('Fase eliminada.');
      },
    });
  const confirmDeleteGroup = (target: ProjectGroup) =>
    setPendingDelete({
      title: '¿Eliminar este grupo?',
      description: `Se eliminará «${target.name}». Sus fases y tareas no se borran: quedan en el proyecto, sin grupo.`,
      confirmLabel: 'Eliminar grupo',
      run: () => {
        deleteProjectGroup(target.id);
        if (group?.id === target.id) navigate(`/project/${project.id}`);
        toast('Grupo eliminado.');
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
    <div className={`${styles.page} ${isMobile && !nested ? styles.withBottomBar : ''}`}>
      {nested ? (
        <Link to={parentPath()} className={styles.back}>
          <ArrowLeft /> {parentGroup?.name ?? project.name} <Kbd>Esc</Kbd>
        </Link>
      ) : (
        <Link to="/" className={styles.back}>
          <ArrowLeft /> Proyectos <Kbd>Esc</Kbd>
        </Link>
      )}

      {phase ? (
        <header className={`${styles.header} ${styles.phaseHeader}`}>
          <div className={styles.heading} {...headerPress}>
            <p className={styles.eyebrow}>
              <Layers /> Fase
            </p>
            <h1 className={styles.title}>{phase.name}</h1>
            {phase.description && <p className={styles.description}><RichText text={phase.description} /></p>}
          </div>
          <div className={styles.actions}>
            {!isMobile && (
              <Button variant="primary" icon={<Plus />} shortcut="T" onClick={newTask}>
                Nueva tarea
              </Button>
            )}
            <Menu
              label="Acciones de la fase"
              {...headerMenu}
              trigger={<Ellipsis />}
              items={[
                { label: 'Editar', icon: <Pencil />, onSelect: () => setPhaseDialog({ phase }) },
                { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => confirmDeletePhase(phase) },
              ]}
            />
          </div>
        </header>
      ) : group ? (
        <header className={`${styles.header} ${styles.phaseHeader}`}>
          <div className={styles.heading} {...headerPress}>
            <p className={styles.eyebrow}>
              <FolderOpen /> Grupo
            </p>
            <h1 className={styles.title}>{group.name}</h1>
            {group.description && <p className={styles.description}><RichText text={group.description} /></p>}
          </div>
          <div className={styles.actions}>
            {!isMobile && (
              <>
                <Button icon={<Layers />} shortcut="F" onClick={newPhase}>
                  Nueva fase
                </Button>
                <Button variant="primary" icon={<Plus />} shortcut="T" onClick={newTask}>
                  Nueva tarea
                </Button>
              </>
            )}
            <Menu
              label="Acciones del grupo"
              {...headerMenu}
              trigger={<Ellipsis />}
              items={[
                { label: 'Nueva fase', icon: <Layers />, onSelect: newPhase },
                { label: 'Editar', icon: <Pencil />, onSelect: () => setGroupDialog({ group }) },
                { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => confirmDeleteGroup(group) },
              ]}
            />
          </div>
        </header>
      ) : (
        <header className={styles.header}>
          <div className={styles.heading} {...headerPress}>
            <h1 className={styles.title}>{project.name}</h1>
            {people && people.length > 1 && <AvatarStack userIds={people} size={22} />}
            {project.description && <p className={styles.description}><RichText text={project.description} /></p>}
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
              {...headerMenu}
              trigger={<Ellipsis />}
              items={[
                { label: 'Nuevo grupo', icon: <FolderOpen />, onSelect: newGroup },
                { label: 'Nueva fase', icon: <Layers />, onSelect: newPhase },
                { label: 'Compartir…', icon: <Share2 />, onSelect: () => setSharing(true) },
                { label: 'Editar', icon: <Pencil />, onSelect: () => setEditing(true) },
                { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => setConfirmingDelete(true) },
              ]}
            />
          </div>
        </header>
      )}

      {nested ? null : isMobile ? (
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
              <Button icon={<FolderOpen />} shortcut="G" className={styles.tabAction} onClick={newGroup}>
                Nuevo grupo
              </Button>
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

      <div role={nested ? undefined : 'tabpanel'}>
        {tab === 'tasks' || nested ? (
          <TaskList
            key={phase?.id ?? group?.id ?? 'project'}
            projectId={project.id}
            phaseId={phase?.id}
            groupId={group?.id}
            onCreate={newTask}
            onCreatePhase={group ? newPhase : undefined}
            onOpen={(task) => setTaskDetailId(task.id)}
            onEdit={editTask}
            onDelete={confirmDeleteTask}
            onEditPhase={(target) => setPhaseDialog({ phase: target })}
            onDeletePhase={confirmDeletePhase}
            onEditGroup={(target) => setGroupDialog({ group: target })}
            onDeleteGroup={confirmDeleteGroup}
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
          aboveBar={!nested}
          label={tab === 'tasks' || nested ? 'Nueva tarea' : 'Nueva idea'}
          onClick={tab === 'tasks' || nested ? newTask : newIdea}
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
        groupId={group?.id}
      />
      <PhaseFormDialog
        open={phaseDialog !== null}
        onClose={() => setPhaseDialog(null)}
        projectId={project.id}
        phase={phaseDialog?.phase}
        groupId={group?.id}
      />
      <GroupFormDialog open={groupDialog !== null} onClose={() => setGroupDialog(null)} projectId={project.id} group={groupDialog?.group} />
      <IdeaFormDialog open={ideaDialog !== null} onClose={() => setIdeaDialog(null)} projectId={project.id} idea={ideaDialog?.idea} />
      <ShareDialog kind="project" target={sharing ? { id: project.id, name: project.name } : undefined} onClose={() => setSharing(false)} />
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
