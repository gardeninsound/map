import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '../story/story.css';
import './admin.css';
import { AdminPage } from './AdminPage';
import { sourcesFrom } from './model';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminPage {...sourcesFrom(location.search)} />
  </StrictMode>,
);
