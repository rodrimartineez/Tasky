import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-700.css';
import './theme.css';
import { HabitPage } from './HabitPage';
import { HabitsHome } from './HabitsHome';
import { HabitsLayout } from './HabitsLayout';
import { PlayPage } from './play/PlayPage';
import { RewardsPage } from './RewardsPage';

/** Entrada del modo Hábitos (se carga en diferido desde ui/app/App.tsx). */
export default function HabitsApp() {
  // Mientras el modo está abierto, toda la página (también diálogos y avisos) usa su identidad visual.
  useEffect(() => {
    document.documentElement.dataset.mode = 'habits';
    return () => {
      delete document.documentElement.dataset.mode;
    };
  }, []);

  return (
    <Routes>
      <Route element={<HabitsLayout />}>
        <Route index element={<HabitsHome />} />
        <Route path="play" element={<PlayPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="habit/:habitId" element={<HabitPage />} />
        <Route path="*" element={<Navigate to="/habits" replace />} />
      </Route>
    </Routes>
  );
}
