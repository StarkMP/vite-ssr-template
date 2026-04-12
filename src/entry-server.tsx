import '@/styles/global.scss';

import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';

import { App } from '@/app';

export const render = () =>
  renderToString(
    <StrictMode>
      <App />
    </StrictMode>
  );
