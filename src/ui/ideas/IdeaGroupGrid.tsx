import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ellipsis, Folder, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { IdeaGroup } from '../../core/model';
import { groupIdeas, ideaGroups } from '../../core/selectors';
import { useTasky } from '../../state/store';
import { Menu } from '../components/Menu';
import { previewText } from '../components/RichText';
import { useLongPressMenu } from '../components/useLongPressMenu';
import ideaStyles from './IdeaGrid.module.css';
import styles from './IdeaGroupGrid.module.css';

interface IdeaGroupGridProps {
  onEdit: (group: IdeaGroup) => void;
  onDelete: (group: IdeaGroup) => void;
}

/** Grupos de ideas generales: tocar uno abre sus ideas; «···» o mantenerlo pulsado lo edita o elimina. */
export function IdeaGroupGrid({ onEdit, onDelete }: IdeaGroupGridProps) {
  const data = useTasky((s) => s.data);
  const groups = useMemo(() => ideaGroups(data).map((group) => ({ group, count: groupIdeas(data, group.id).length })), [data]);

  return (
    <ul className={ideaStyles.grid} aria-label="Grupos de ideas">
      <AnimatePresence initial={false} mode="popLayout">
        {groups.map(({ group, count }) => (
          <motion.li
            key={group.id}
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <GroupCard group={group} count={count} onEdit={onEdit} onDelete={onDelete} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function GroupCard({ group, count, onEdit, onDelete }: IdeaGroupGridProps & { group: IdeaGroup; count: number }) {
  const { menu, press } = useLongPressMenu();
  return (
    <div className={ideaStyles.cardWrap} {...press}>
      <Link to={`/ideas/${group.id}`} className={`${ideaStyles.card} ${styles.card}`}>
        <span className={`${ideaStyles.icon} ${styles.icon}`}>
          <Folder />
        </span>
        <span className={ideaStyles.title}>{group.name}</span>
        {group.description && <span className={ideaStyles.description}>{previewText(group.description)}</span>}
        <span className={ideaStyles.date}>{count === 0 ? 'Sin ideas' : `${count} ${count === 1 ? 'idea' : 'ideas'}`}</span>
      </Link>
      <div className={ideaStyles.cardMenu}>
        <Menu
          label={`Acciones del grupo «${group.name}»`}
          trigger={<Ellipsis />}
          triggerClassName={ideaStyles.menuTrigger}
          {...menu}
          items={[
            { label: 'Editar', icon: <Pencil />, onSelect: () => onEdit(group) },
            { label: 'Eliminar', icon: <Trash2 />, danger: true, onSelect: () => onDelete(group) },
          ]}
        />
      </div>
    </div>
  );
}
