import { CalendarDays, Moon, Sun, Sunrise } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TimeSlot } from '../../core/model';
import { TIME_SLOTS } from '../../core/selectors';
import type { SegmentedOption } from '../components/Segmented';

export const TIME_SLOT_INFO: Record<TimeSlot, { label: string; icon: ReactNode; color: string }> = {
  morning: { label: 'Mañana', icon: <Sunrise />, color: 'var(--idea)' },
  afternoon: { label: 'Tarde', icon: <Sun />, color: 'var(--orange-500)' },
  evening: { label: 'Noche', icon: <Moon />, color: '#818cf8' },
  all_day: { label: 'Día completo', icon: <CalendarDays />, color: 'var(--text-faint)' },
};

export const TIME_SLOT_OPTIONS: SegmentedOption<TimeSlot>[] = TIME_SLOTS.map((slot) => ({
  value: slot,
  label: TIME_SLOT_INFO[slot].label,
  color: TIME_SLOT_INFO[slot].color,
}));
