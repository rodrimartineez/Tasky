import { useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { useTasky } from '../../state/store';
import { useSync } from '../../state/sync';
import { ConsentPage } from '../sync/ConsentPage';
import { LoginPage } from '../sync/LoginPage';
import { AppLayout } from './AppLayout';
import { LoadError } from './LoadError';
import { Splash } from './Splash';
import { HomePage } from '../projects/HomePage';
import { ProjectPage } from '../projects/ProjectPage';

/** Autorización OAuth de asistentes (Claude): ruta real, fuera del enrutado por # de la app. */
const isConsentRoute = () => window.location.pathname.replace(/\/$/, '') === '/oauth/consent';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function App() {
  const status = useTasky((s) => s.status);
  const requireAuth = useSync((s) => s.requireAuth);
  const syncStatus = useSync((s) => s.status);
  // Web: sin sesión no se muestra ningún dato (ni mientras se comprueba la sesión).
  const locked = requireAuth && (syncStatus === 'checking' || syncStatus === 'signed_out');
  const [splash, setSplash] = useState(() => !prefersReducedMotion());

  return (
    <MotionConfig reducedMotion="user">
      {requireAuth && syncStatus === 'signed_out' && <LoginPage />}
      {!locked && status === 'ready' && isConsentRoute() && (
        <ConsentPage authorizationId={new URLSearchParams(window.location.search).get('authorization_id')} />
      )}
      {!locked && status === 'ready' && !isConsentRoute() && (
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
      {!locked && status === 'error' && <LoadError />}
      <AnimatePresence>{splash && <Splash onDone={() => setSplash(false)} />}</AnimatePresence>
    </MotionConfig>
  );
}
