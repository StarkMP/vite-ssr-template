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
  const inFlight = new Map<string, Promise<{ html: string; didError: boolean }>>();

  async function doRender(url: string): Promise<{ html: string; didError: boolean }> {
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

    await shellPromise.catch((error: unknown) => {
      clearTimeout(timer);
      throw error;
    });

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
    html = await beasties.process(html);

    htmlCache.set(url, html);

    return { html, didError };
  }

  function renderWithDedup(url: string): Promise<{ html: string; didError: boolean }> {
    const existing = inFlight.get(url);
    if (existing) return existing;

    const promise = doRender(url).finally(() => inFlight.delete(url));
    inFlight.set(url, promise);
    return promise;
  }

  return {
    async handleRequest(request: FastifyRequest, reply: FastifyReply) {
      const url = request.url;

      const cached = htmlCache.get(url);

      if (cached) {
        reply.hijack();
        reply.raw.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        reply.raw.end(cached, 'utf8');
        return;
      }

      let html: string;
      let didError: boolean;

      try {
        ({ html, didError } = await renderWithDedup(url));
      } catch {
        reply.hijack();
        reply.raw.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        reply.raw.end('<h1>Something went wrong</h1>', 'utf8');
        return;
      }

      reply.hijack();
      reply.raw.writeHead(didError ? 500 : 200, { 'Content-Type': 'text/html; charset=utf-8' });
      reply.raw.end(html, 'utf8');
    },
  };
};
