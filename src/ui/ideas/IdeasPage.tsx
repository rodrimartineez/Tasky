import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ellipsis, Folder, FolderPlus, Lightbulb, Pencil, Plus, Trash2 } from 'lucide-react';
import { findIdeaGroup, GENERAL_IDEAS_ID } from '../../core/ideas';
import type { Idea, IdeaGroup } from '../../core/model';
import { groupIdeas, ideaGroups } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { ShareDialog } from '../collab/ShareDialog';
import { Button } from '../components/Button';
import { Fab } from '../components/Fab';
import { Kbd } from '../components/Kbd';
import { Menu } from '../components/Menu';
import { RichText } from '../components/RichText';
import { MOBILE_QUERY, TOUCH_QUERY, useMediaQuery } from '../components/useMediaQuery';
import { useLongPressMenu } from '../components/useLongPressMenu';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from '../components/Toaster';
import { useShortcut } from '../shortcuts/useShortcut';
import styles from '../projects/ProjectPage.module.css';
import groupStyles from './IdeaGroupGrid.module.css';
import { IdeaDetailDialog } from './IdeaDetailDialog';
import { IdeaFormDialog } from './IdeaFormDialog';
import { IdeaGrid } from './IdeaGrid';
import { IdeaGroupFormDialog } from './IdeaGroupFormDialog';
import { IdeaGroupGrid } from './IdeaGroupGrid';

const ideasLabel = (n: number) => `${n} ${n === 1 ? 'idea guardada' : 'ideas guardadas'}`;

/**
 * Ideas generales: notas para futuros proyectos, sin pertenecer a ninguno. Se organizan en grupos.
 * Sin `groupId` se ven los grupos y las ideas sueltas (G crea un grupo, I una idea suelta; en móvil el «+» crea grupos);
 * con `groupId`, las ideas de ese grupo (I o el «+» crean una idea dentro).
 */
export function IdeasPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const data = useTasky((s) => s.data);
  const deleteIdea = useTasky((s) => s.deleteIdea);
  const deleteIdeaGroup = useTasky((s) => s.deleteIdeaGroup);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isTouch = useMediaQuery(TOUCH_QUERY);
  const { menu: headerMenu, press: headerPress } = useLongPressMenu();
  const group = groupId ? findIdeaGroup(data, groupId) : undefined;
  const groups = ideaGroups(data);
  const count = groupIdeas(data, group?.id ?? null).length;
  const [dialog, setDialog] = useState<{ idea?: Idea } | null>(null);
  const [groupDialog, setGroupDialog] = useState<{ group?: IdeaGroup } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = data.ideas.find((i) => i.id === detailId && !i.deletedAt);
  const [deleting, setDeleting] = useState<Idea | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<IdeaGroup | null>(null);
  const [sharing, setSharing] = useState<Idea | null>(null);
  const newIdea = () => setDialog({});
  const newGroup = () => setGroupDialog({});

  useShortcut('Escape', () => navigate(groupId ? '/ideas' : '/'));
  useShortcut('i', newIdea);
  useShortcut('g', newGroup, !groupId);

  if (groupId && !group) return <Navigate to="/ideas" replace />;

  const grid = (
    <IdeaGrid
      projectId={GENERAL_IDEAS_ID}
      general
      groupId={group?.id ?? null}
      onCreate={newIdea}
      onOpen={(idea) => setDetailId(idea.id)}
      onEdit={(idea) => {
        setDetailId(null);
        setDialog({ idea });
      }}
      onDelete={setDeleting}
      onShare={(idea) => setSharing(idea)}
    />
  );

  return (
    <div className={styles.page}>
      <Link to={group ? '/ideas' : '/'} className={styles.back}>
        <ArrowLeft /> {group ? 'Ideas' : 'Proyectos'} <Kbd>Esc</Kbd>
      </Link>

      {group ? (
        <header className={styles.header}>
          <div className={styles.heading} {...headerPress}>
            <p className={styles.eyebrow}>
              <Folder /> Grupo de ideas
            </p>
            <h1 className={styles.title}>{group.name}</h1>
            <p className={styles.description}>
              {group.description ? <RichText text={group.description} /> : (count === 0 ? 'Todavía no hay ideas en este grupo.' : ideasLabel(count))}
              {count === 0 && !isTouch ? ' Pulsa I para añadir la primera.' : ''}
            </p>
          </div>
          <div className={styles.actions}>
            {!isMobile && (
              <Button variant="primary" icon={<Plus />} shortcut="I" onClick={newIdea}>
                Nueva idea
              </Button>
            )}
            <Menu
              label="Acciones del grupo"
              {...headerMenu}
              trigger={<Ellipsis />}
              items={[
                { label: 'Editar', icon: <Pencil />, onSelect: () => setGroupDialog({ group }) },
                { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => setDeletingGroup(group) },
              ]}
            />
          </div>
        </header>
      ) : (
        <header className={styles.header}>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>
              <Lightbulb /> Ideas generales
            </p>
            <h1 className={styles.title}>Ideas</h1>
            <p className={styles.description}>
              {count === 0 && groups.length === 0
                ? 'Para futuros proyectos y cosas que no encajan todavía en uno.'
                : groupsSummary(groups.length, count)}
              {count === 0 && groups.length === 0 && !isTouch ? ' Pulsa G para crear un grupo o I para añadir una idea.' : ''}
            </p>
          </div>
          {!isMobile && (
            <div className={styles.actions}>
              <Button icon={<FolderPlus />} shortcut="G" onClick={newGroup}>
                Nuevo grupo
              </Button>
              <Button variant="primary" icon={<Plus />} shortcut="I" onClick={newIdea}>
                Nueva idea
              </Button>
            </div>
          )}
        </header>
      )}

      {group || groups.length === 0 ? (
        grid
      ) : (
        <>
          <section className={groupStyles.section}>
            <h2 className={groupStyles.sectionTitle}>Grupos</h2>
            <IdeaGroupGrid onEdit={(g) => setGroupDialog({ group: g })} onDelete={setDeletingGroup} />
          </section>
          {count > 0 && (
            <section className={groupStyles.section}>
              <h2 className={groupStyles.sectionTitle}>Sin grupo</h2>
              {grid}
            </section>
          )}
        </>
      )}

      {isMobile && <Fab label={group ? 'Nueva idea' : 'Nuevo grupo'} onClick={group ? newIdea : newGroup} />}
      <IdeaDetailDialog
        idea={detail}
        onClose={() => setDetailId(null)}
        onShare={(idea) => {
          setDetailId(null);
          setSharing(idea);
        }}
        onEdit={(idea) => {
          setDetailId(null);
          setDialog({ idea });
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="¿Eliminar esta idea?"
        description={`«${deleting?.title ?? ''}» se eliminará definitivamente.`}
        confirmLabel="Eliminar idea"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteIdea(deleting.id);
          setDeleting(null);
          toast('Idea eliminada.');
        }}
      />
      <ConfirmDialog
        open={deletingGroup !== null}
        title="¿Eliminar este grupo?"
        description={`Se eliminará «${deletingGroup?.name ?? ''}». Sus ideas no se borran: quedan sin grupo.`}
        confirmLabel="Eliminar grupo"
        onClose={() => setDeletingGroup(null)}
        onConfirm={() => {
          if (deletingGroup) deleteIdeaGroup(deletingGroup.id);
          if (deletingGroup?.id === group?.id) navigate('/ideas');
          setDeletingGroup(null);
          toast('Grupo eliminado.');
        }}
      />
      <ShareDialog kind="idea" target={sharing ? { id: sharing.id, name: sharing.title } : undefined} onClose={() => setSharing(null)} />
      <IdeaFormDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        projectId={GENERAL_IDEAS_ID}
        idea={dialog?.idea}
        groupId={group?.id ?? null}
      />
      <IdeaGroupFormDialog open={groupDialog !== null} onClose={() => setGroupDialog(null)} group={groupDialog?.group} />
    </div>
  );
}

function groupsSummary(groups: number, loose: number): string {
  const parts = [];
  if (groups > 0) parts.push(`${groups} ${groups === 1 ? 'grupo' : 'grupos'}`);
  if (loose > 0) parts.push(groups > 0 ? `${loose} ${loose === 1 ? 'idea sin grupo' : 'ideas sin grupo'}` : ideasLabel(loose));
  return parts.join(' · ');
}
