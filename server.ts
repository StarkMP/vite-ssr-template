import fastifyCompress from '@fastify/compress';
import Fastify from 'fastify';

import type { ServerSideRenderingSetup } from './src/server/types.ts';

const PORT = 5173;
const isProd = process.env.NODE_ENV === 'production';

async function createServer() {
  console.info(`Starting server in ${isProd ? 'production' : 'development'} mode...`);

  const fastify = Fastify({ logger: true });
  await fastify.register(fastifyCompress, { encodings: ['br', 'gzip'] });

  let setup: ServerSideRenderingSetup;

  // directly use prcoess.env to help tsup avoid excess code
  if (process.env.NODE_ENV === 'production') {
    const { setupProd } = await import('./src/server/production.ts');
    setup = await setupProd(fastify);
  } else {
    const { setupDev } = await import('./src/server/development.ts');
    setup = await setupDev(fastify);
  }

  fastify.setNotFoundHandler(async (request, reply) => {
    const url = request.url;

    try {
      const cached = setup.getCached?.(url);
      if (cached) return reply.code(200).type('text/html').send(cached);

      const template = await setup.getTemplate(url);
      const appHtml = await setup.renderApp(url);
      let html = template.replace('<!--ssr-outlet-->', () => appHtml);

      if (setup.processHtml) {
        html = await setup.processHtml(url, html);
      }

      return reply.code(200).type('text/html').send(html);
    } catch (error) {
      setup.fixStacktrace?.(error as Error);
      throw error;
    }
  });

  await fastify.listen({ port: PORT });
}

void createServer();
