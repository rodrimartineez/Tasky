import { CalendarClock } from 'lucide-react';
import { daysBetween, dueState } from '../../core/dueDates';
import type { LocalDate } from '../../core/model';
import styles from './DueBadge.module.css';

const toDate = (d: LocalDate) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};
const weekdayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const dayMonthFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Texto corto y legible para una fecha límite relativa a hoy. */
export function dueLabel(due: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, due);
  switch (dueState(due, today)) {
    case 'overdue':
      return diff === -1 ? 'Venció ayer' : `Venció hace ${-diff} días`;
    case 'today':
      return 'Hoy';
    case 'tomorrow':
      return 'Mañana';
    case 'soon':
      return weekdayFmt.format(toDate(due)).replace(',', '');
    default:
      return (due.slice(0, 4) === today.slice(0, 4) ? dayMonthFmt : fullFmt).format(toDate(due)).replace('.', '');
  }
}

interface DueBadgeProps {
  due: LocalDate;
  today: LocalDate;
  /** En tareas completadas la fecha se muestra sin alerta. */
  muted?: boolean;
  prefix?: string;
}

export function DueBadge({ due, today, muted, prefix }: DueBadgeProps) {
  const state = muted ? 'muted' : dueState(due, today);
  return (
    <span className={`${styles.badge} ${styles[state]}`} title={`Fecha límite: ${longFmt.format(toDate(due))}`}>
      <CalendarClock />
      {prefix}
      {dueLabel(due, today)}
    </span>
  );
}
