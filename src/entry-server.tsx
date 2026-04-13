import '@/styles/global.scss';

import { StrictMode } from 'react';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream } from 'react-dom/server';

import { App } from '@/app';

export const render = (_url: string, callbacks: RenderToPipeableStreamOptions) =>
  renderToPipeableStream(
    <StrictMode>
      <App />
    </StrictMode>,
    callbacks
  );
