import '@/index.scss';

import { StrictMode } from 'react';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream } from 'react-dom/server';

import { App } from '@/App';

export const render = (_url: string, callbacks: RenderToPipeableStreamOptions) =>
  renderToPipeableStream(
    <StrictMode>
      <App />
    </StrictMode>,
    callbacks
  );
