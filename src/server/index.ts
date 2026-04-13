import fastifyCompress from '@fastify/compress';
import Fastify from 'fastify';

import type { ServerSideRenderingSetup } from './types.ts';

const PORT = 5173;
const isProd = process.env.NODE_ENV === 'production';

async function createServer() {
  console.info(`Starting server in ${isProd ? 'production' : 'development'} mode...`);

  const fastify = Fastify({ logger: true });
  await fastify.register(fastifyCompress, { encodings: ['br', 'gzip'] });

  let setup: ServerSideRenderingSetup;

  // directly use prcoess.env to help tsup avoid excess code
  if (process.env.NODE_ENV === 'production') {
    const { setupProd } = await import('./production.ts');
    setup = await setupProd(fastify);
  } else {
    const { setupDev } = await import('./development.ts');
    setup = await setupDev(fastify);
  }

  fastify.setNotFoundHandler(async (request, reply) => {
    try {
      await setup.handleRequest(request, reply);
    } catch (error) {
      setup.fixStacktrace?.(error as Error);
      throw error;
    }
  });

  await fastify.listen({ port: PORT });
}

void createServer();
