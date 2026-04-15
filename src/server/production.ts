import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';

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
const HTML_CACHE_MAX_SIZE = 500 * 1024 * 1024; // 500 MB

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

  type CachedEntry = { compressed: Buffer; etag: string; didError: boolean };

  const htmlCache = new LRUCache<string, CachedEntry>({
    maxSize: HTML_CACHE_MAX_SIZE,
    sizeCalculation: (entry) => entry.compressed.byteLength,
    ttl: 1000 * 60 * 60,
  });
  const inFlight = new Map<string, Promise<CachedEntry>>();

  async function doRender(url: string): Promise<CachedEntry> {
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

    const compressed = brotliCompressSync(Buffer.from(html, 'utf8'));
    const etag = `"${createHash('md5').update(compressed).digest('hex')}"`;
    const entry: CachedEntry = { compressed, etag, didError };

    if (!didError) {
      htmlCache.set(url, entry);
    }

    return entry;
  }

  function renderWithDedup(url: string): Promise<CachedEntry> {
    const existing = inFlight.get(url);
    if (existing) return existing;

    const promise = doRender(url).finally(() => inFlight.delete(url));
    inFlight.set(url, promise);
    return promise;
  }

  function sendEntry(request: FastifyRequest, reply: FastifyReply, entry: CachedEntry) {
    const acceptsBrotli = request.headers['accept-encoding']?.includes('br') ?? false;

    reply.hijack();
    reply.raw.writeHead(entry.didError ? 500 : 200, {
      'Content-Type': 'text/html; charset=utf-8',
      ...(acceptsBrotli && { 'Content-Encoding': 'br' }),
      ETag: entry.etag,
    });
    reply.raw.end(acceptsBrotli ? entry.compressed : brotliDecompressSync(entry.compressed));
  }

  return {
    async handleRequest(request: FastifyRequest, reply: FastifyReply) {
      const url = request.url;

      const cached = htmlCache.get(url);

      if (cached) {
        if (request.headers['if-none-match'] === cached.etag) {
          reply.hijack();
          reply.raw.writeHead(304);
          reply.raw.end();
          return;
        }
        sendEntry(request, reply, cached);
        return;
      }

      let entry: CachedEntry;

      try {
        entry = await renderWithDedup(url);
      } catch {
        reply.hijack();
        reply.raw.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        reply.raw.end('<h1>Something went wrong</h1>', 'utf8');
        return;
      }

      sendEntry(request, reply, entry);
    },
  };
};
