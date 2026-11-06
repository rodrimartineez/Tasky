import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/global.css';
import { createPlatform } from './adapters';
import { useTasky } from './state/store';
import { initSync } from './state/sync';
import { App } from './ui/app/App';

const platform = createPlatform();
const loaded = useTasky.getState().load(platform.storage, platform.fileExport);
void initSync(platform.sync, platform.requireAuth, loaded);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
