import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/global.css';
import { createStorage } from './adapters';
import { useTasky } from './state/store';
import { App } from './ui/app/App';

void useTasky.getState().load(createStorage());

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
