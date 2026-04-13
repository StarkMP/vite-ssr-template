import '@/styles/global.scss';

import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { App } from '@/app';

hydrateRoot(
  document.querySelector('#root')!,
  <StrictMode>
    <App />
  </StrictMode>
);
