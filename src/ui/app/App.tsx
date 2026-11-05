import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { useTasky } from '../../state/store';
import { AppLayout } from './AppLayout';
import { LoadError } from './LoadError';
import { HomePage } from '../projects/HomePage';
import { ProjectPage } from '../projects/ProjectPage';

export function App() {
  const status = useTasky((s) => s.status);
  if (status === 'loading') return null;
  if (status === 'error') return <LoadError />;

  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="project/:projectId" element={<ProjectPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </MotionConfig>
  );
}
