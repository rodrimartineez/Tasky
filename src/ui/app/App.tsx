import { useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { useTasky } from '../../state/store';
import { AppLayout } from './AppLayout';
import { LoadError } from './LoadError';
import { Splash } from './Splash';
import { HomePage } from '../projects/HomePage';
import { ProjectPage } from '../projects/ProjectPage';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function App() {
  const status = useTasky((s) => s.status);
  const [splash, setSplash] = useState(() => !prefersReducedMotion());

  return (
    <MotionConfig reducedMotion="user">
      {status === 'ready' && (
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="project/:projectId" element={<ProjectPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      )}
      {status === 'error' && <LoadError />}
      <AnimatePresence>{splash && <Splash onDone={() => setSplash(false)} />}</AnimatePresence>
    </MotionConfig>
  );
}
