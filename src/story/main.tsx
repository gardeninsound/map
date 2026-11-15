import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './story.css';
import { srcFrom } from './model';
import { StoryPage } from './StoryPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoryPage src={srcFrom(location.search)} />
  </StrictMode>,
);
