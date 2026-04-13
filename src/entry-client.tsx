import '@/index.scss';

import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { App } from '@/App';

hydrateRoot(
  document.querySelector('#root')!,
  <StrictMode>
    <App />
  </StrictMode>
);
