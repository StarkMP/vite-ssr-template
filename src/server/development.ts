import fs from 'node:fs';
import path from 'node:path';
import { PassThrough, Transform } from 'node:stream';

import fastifyMiddie from '@fastify/middie';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PipeableStream, RenderToPipeableStreamOptions } from 'react-dom/server';
import { createServer as createViteServer } from 'vite';

import type { ServerSideRenderingSetup } from './types.ts';

type RenderFn = (url: string, callbacks: RenderToPipeableStreamOptions) => PipeableStream;

const INDEX_HTML = path.join(import.meta.dirname, '../../index.html');
const ABORT_DELAY = 10_000;

export const setupDev = async (fastify: FastifyInstance): Promise<ServerSideRenderingSetup> => {
  await fastify.register(fastifyMiddie);

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  fastify.use(vite.middlewares);

  return {
    async handleRequest(request: FastifyRequest, reply: FastifyReply) {
      const url = request.url;

      const raw = fs.readFileSync(INDEX_HTML, 'utf8');
      const template = await vite.transformIndexHtml(url, raw);
      const [htmlStart, htmlEnd] = template.split('<!--ssr-outlet-->');

      const { render } = (await vite.ssrLoadModule('/src/entry-server.tsx')) as {
        render: RenderFn;
      };

      let didError = false;
      let resolveShell!: () => void;
      let rejectShell!: (err: unknown) => void;

      const shellPromise = new Promise<void>((resolve, reject) => {
        resolveShell = resolve;
        rejectShell = reject;
      });

      const { pipe, abort } = render(url, {
        onShellReady: resolveShell,
        onShellError: rejectShell,
        onError(error) {
          didError = true;
          console.error(error);
        },
      });

      const timer = setTimeout(() => abort(), ABORT_DELAY);

      try {
        await shellPromise;
      } catch {
        clearTimeout(timer);
        reply.code(500).type('text/html').send('<h1>Something went wrong</h1>');
        return;
      }

      const passThrough = new PassThrough();
      reply
        .code(didError ? 500 : 200)
        .type('text/html')
        .send(passThrough);

      passThrough.write(htmlStart);

      const transform = new Transform({
        transform(chunk, _encoding, callback) {
          passThrough.write(chunk);
          callback();
        },
        flush(callback) {
          passThrough.write(htmlEnd);
          passThrough.end();
          clearTimeout(timer);
          callback();
        },
      });

      transform.on('error', (error) => {
        clearTimeout(timer);
        passThrough.destroy(error);
      });

      pipe(transform);
    },
    fixStacktrace: (error) => vite.ssrFixStacktrace(error),
  };
};
