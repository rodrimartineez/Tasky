import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/global.css';
import { createPlatform } from './adapters';
import { useTasky } from './state/store';
import { App } from './ui/app/App';

const platform = createPlatform();
void useTasky.getState().load(platform.storage, platform.fileExport);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
