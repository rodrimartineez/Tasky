import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { HomePage } from '../projects/HomePage';
import { sampleData } from './sampleData';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          {/* La creación de proyectos se conecta en la Fase 3. */}
          <Route index element={<HomePage data={sampleData} onCreateProject={() => {}} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
