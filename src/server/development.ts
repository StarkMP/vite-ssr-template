import fs from 'node:fs';
import path from 'node:path';

import fastifyMiddie from '@fastify/middie';
import type { FastifyInstance } from 'fastify';
import { createServer as createViteServer } from 'vite';

import type { ServerSideRenderingSetup } from './types.ts';

const INDEX_HTML = path.join(import.meta.dirname, '../../index.html');

export const setupDev = async (fastify: FastifyInstance): Promise<ServerSideRenderingSetup> => {
  await fastify.register(fastifyMiddie);

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  fastify.use(vite.middlewares);

  return {
    async getTemplate(url) {
      const raw = fs.readFileSync(INDEX_HTML, 'utf8');
      return vite.transformIndexHtml(url, raw);
    },
    async renderApp(url) {
      const { render } = (await vite.ssrLoadModule('/src/entry-server.tsx')) as {
        render: (url: string) => Promise<string>;
      };
      return render(url);
    },
    fixStacktrace: (error) => vite.ssrFixStacktrace(error),
  };
};
