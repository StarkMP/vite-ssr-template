import fs from 'node:fs';
import path from 'node:path';

import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import Beasties from 'beasties';
import Fastify from 'fastify';
import type { ViteDevServer } from 'vite';
import { createServer as createViteServer } from 'vite';

const PORT = 5173;
const isProd = process.env.NODE_ENV === 'production';

async function createServer() {
  console.info(`Starting server in ${isProd ? 'production' : 'development'} mode...`);

  const fastify = Fastify({ logger: true });

  let vite: ViteDevServer | undefined;
  let prodTemplate: string | undefined;
  let prodRender: ((url: string) => Promise<string>) | undefined;
  let beasties: Beasties | undefined;

  if (isProd) {
    await fastify.register(fastifyStatic, {
      root: path.resolve(import.meta.dirname, 'dist/client'),
      index: false,
    });

    prodTemplate = fs.readFileSync(
      path.resolve(import.meta.dirname, 'dist/client/index.html'),
      'utf8'
    );

    // @ts-expect-error bundled path
    ({ render: prodRender } = await import('./dist/server/entry-server.js'));

    beasties = new Beasties({ path: path.resolve(import.meta.dirname, 'dist/client') });
  } else {
    await fastify.register(fastifyMiddie);

    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    fastify.use(vite.middlewares);
  }

  fastify.get('/*', async (request, reply) => {
    const url = request.url;

    try {
      let template: string;
      let render: (url: string) => Promise<string>;

      if (isProd) {
        template = prodTemplate!;
        render = prodRender!;
      } else {
        template = await vite!.transformIndexHtml(
          url,
          fs.readFileSync(path.resolve(import.meta.dirname, 'index.html'), 'utf8')
        );

        ({ render } = await vite!.ssrLoadModule('/src/entry-server.tsx'));
      }

      const appHtml = await render(url);
      let html = template.replace('<!--ssr-outlet-->', () => appHtml);

      if (beasties) {
        html = await beasties.process(html);
      }

      return reply.type('text/html').send(html);
    } catch (error) {
      vite?.ssrFixStacktrace(error as Error);
      throw error;
    }
  });

  await fastify.listen({ port: PORT });
}

void createServer();
