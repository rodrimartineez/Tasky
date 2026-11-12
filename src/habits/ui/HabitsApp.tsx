import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-700.css';
import './theme.css';
import { CatalogPage } from './CatalogPage';
import { SpritesPage } from './SpritesPage';
import { GAME_BUILD } from '../core/release';
import { HabitPage } from './HabitPage';
import { HabitsHome } from './HabitsHome';
import { HabitsLayout } from './HabitsLayout';
import { PlayPage } from './play/PlayPage';
import { RecordsPage } from './RecordsPage';
import { ProgressPage } from './ProgressPage';
import { UpgradesPage } from './UpgradesPage';

/** Fondo de la cabecera (igual que --hb-header-bg en theme.css). */
const HABITS_HEADER_BG = '#0d0b1a';

/** Entrada del modo Hábitos (se carga en diferido desde ui/app/App.tsx). */
export default function HabitsApp() {
  // Mientras el modo está abierto, toda la página (también diálogos y avisos) usa su identidad visual.
  useEffect(() => {
    document.documentElement.dataset.mode = 'habits';
    // La barra de estado del móvil toma el color de la cabecera de Hábitos (y vuelve al de Proyectos al salir).
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    if (meta) meta.content = HABITS_HEADER_BG;
    return () => {
      delete document.documentElement.dataset.mode;
      if (meta && previous) meta.content = previous;
    };
  }, []);

  return (
    <Routes>
      <Route element={<HabitsLayout />}>
        <Route index element={<HabitsHome />} />
        <Route path="play" element={<PlayPage />} />
        <Route path="upgrades" element={<UpgradesPage />} />
        <Route path="progress" element={<ProgressPage />} />
        {/* Antes «Recompensas»: los enlaces antiguos llevan a Progreso. */}
        <Route path="rewards" element={<Navigate to="/habits/progress" replace />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        {GAME_BUILD.devTools && <Route path="sprites" element={<SpritesPage />} />}
        <Route path="habit/:habitId" element={<HabitPage />} />
        <Route path="*" element={<Navigate to="/habits" replace />} />
      </Route>
    </Routes>
  );
}
