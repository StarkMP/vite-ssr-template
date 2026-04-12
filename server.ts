import fastifyCompress from '@fastify/compress';
import Fastify from 'fastify';

import { setupDev } from './src/server/development.ts';
import { setupProd } from './src/server/production.ts';

const PORT = 5173;
const isProd = process.env.NODE_ENV === 'production';

async function createServer() {
  console.info(`Starting server in ${isProd ? 'production' : 'development'} mode...`);

  const fastify = Fastify({ logger: true });
  await fastify.register(fastifyCompress, { encodings: ['br', 'gzip'] });

  const setup = isProd ? await setupProd(fastify) : await setupDev(fastify);

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
