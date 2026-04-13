import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';

import fastifyStatic from '@fastify/static';
import Beasties from 'beasties';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { LRUCache } from 'lru-cache';
import type { PipeableStream, RenderToPipeableStreamOptions } from 'react-dom/server';

import type { ServerSideRenderingSetup } from './types.ts';

type RenderFn = (url: string, callbacks: RenderToPipeableStreamOptions) => PipeableStream;

const DIST_CLIENT = path.join(import.meta.dirname, '../../dist/client');
const ASSETS_ROOT = path.join(DIST_CLIENT, 'assets');
const ABORT_DELAY = 10_000;

export const setupProd = async (fastify: FastifyInstance): Promise<ServerSideRenderingSetup> => {
  await fastify.register(fastifyStatic, {
    root: DIST_CLIENT,
    index: false,
    preCompressed: true,
    setHeaders(res, filePath) {
      if (filePath.startsWith(ASSETS_ROOT)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });

  const template = fs.readFileSync(path.join(DIST_CLIENT, 'index.html'), 'utf8');
  const [htmlStart, htmlEnd] = template.split('<!--ssr-outlet-->');
  const entryUrl = pathToFileURL(
    path.join(import.meta.dirname, '../../dist/server/entry-server.js')
  ).href;
  const { render } = (await import(entryUrl)) as { render: RenderFn };
  const beasties = new Beasties({ path: DIST_CLIENT });
  const htmlCache = new LRUCache<string, string>({ max: 500, ttl: 1000 * 60 * 60 });

  return {
    async handleRequest(request: FastifyRequest, reply: FastifyReply) {
      const url = request.url;

      const cached = htmlCache.get(url);

      if (cached) {
        reply.code(200).type('text/html').send(cached);
        return;
      }

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

      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        const writable = new Writable({
          write(chunk: Buffer, _encoding, callback) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            callback();
          },
          final(callback) {
            clearTimeout(timer);
            callback();
            resolve();
          },
        });

        writable.on('error', reject);

        pipe(writable);
      });

      const appHtml = Buffer.concat(chunks).toString('utf8');
      let html = htmlStart + appHtml + htmlEnd;
      // html = await minifyHTML(withCriticalCSS, {
      //   collapseWhitespace: true,
      //   removeComments: true,
      //   minifyCSS: true,
      //   minifyJS: true,
      // });
      html = await beasties.process(html);

      htmlCache.set(url, html);

      reply
        .code(didError ? 500 : 200)
        .type('text/html')
        .send(html);
    },
  };
};
