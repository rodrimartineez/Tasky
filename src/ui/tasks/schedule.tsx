import { CalendarCheck, Repeat } from 'lucide-react';
import { daysBetween, nextScheduledDay, weekday } from '../../core/dueDates';
import type { LocalDate, Task } from '../../core/model';
import styles from './DueBadge.module.css';

const toDate = (d: LocalDate) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};
const weekdayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const dayMonthFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «Hoy», «Mañana», «jue 12» (esta semana) o «12 nov». */
export function dayLabel(day: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  const fmt = diff > 1 && diff < 7 ? weekdayFmt : dayMonthFmt;
  return fmt.format(toDate(day)).replace(',', '').replace('.', '');
}

/** «a», «a y b», «a, b y c». */
const joinList = (items: string[]) => (items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`);

/** Texto completo de la programación, o null si no está programada. */
export function scheduleSummary(task: Pick<Task, 'scheduledDays' | 'repeatWeekly'>, today: LocalDate): string | null {
  if (task.scheduledDays.length === 0) return null;
  if (task.repeatWeekly) {
    // De lunes a domingo, sin repetir.
    const days = [...new Set(task.scheduledDays.map(weekday))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return `Cada ${joinList(days.map((d) => WEEKDAYS[d]))}`;
  }
  return joinList(task.scheduledDays.map((d) => dayLabel(d, today)));
}

/** Distintivo compacto: el próximo día programado (o el último, si ya pasaron todos). */
export function ScheduleBadge({ task, today, muted }: { task: Task; today: LocalDate; muted?: boolean }) {
  if (task.scheduledDays.length === 0) return null;
  const next = nextScheduledDay(task, today);
  const day = next ?? task.scheduledDays.at(-1)!;
  const state = muted || !next ? 'muted' : next === today ? 'today' : 'soon';
  return (
    <span className={`${styles.badge} ${styles[state]}`} title={`Programada: ${scheduleSummary(task, today)}`}>
      {task.repeatWeekly ? <Repeat /> : <CalendarCheck />}
      {dayLabel(day, today)}
    </span>
  );
}
