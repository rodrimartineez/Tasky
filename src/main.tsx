import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/global.css';
import { createPlatform } from './adapters';
import { startHabits } from './habits';
import { useTasky } from './state/store';
import { initSync } from './state/sync';
import { App } from './ui/app/App';
import { restoreMode } from './ui/app/mode';

const platform = createPlatform();
const loaded = useTasky.getState().load(platform.storage, platform.fileExport);
void initSync(platform.sync, platform.requireAuth, loaded);
startHabits();
restoreMode();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
