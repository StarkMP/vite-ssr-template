import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import fastifyStatic from '@fastify/static';
import Beasties from 'beasties';
import type { FastifyInstance } from 'fastify';
import { minify as minifyHTML } from 'html-minifier-terser';
import { LRUCache } from 'lru-cache';

import type { ServerSideRenderingSetup } from './types.ts';

const DIST_CLIENT = path.join(import.meta.dirname, '../../dist/client');
const ASSETS_ROOT = path.join(DIST_CLIENT, 'assets');

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
  const entryUrl = pathToFileURL(
    path.join(import.meta.dirname, '../../dist/server/entry-server.js')
  ).href;
  const { render } = (await import(entryUrl)) as { render: (url: string) => Promise<string> };
  const beasties = new Beasties({ path: DIST_CLIENT });
  const htmlCache = new LRUCache<string, string>({ max: 500, ttl: 1000 * 60 * 60 });

  return {
    getTemplate: () => Promise.resolve(template),
    renderApp: (url) => render(url),
    getCached: (url) => htmlCache.get(url),
    async processHtml(url, html) {
      const withCriticalCSS = await beasties.process(html);
      const processed = await minifyHTML(withCriticalCSS, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
      });

      htmlCache.set(url, processed);

      return processed;
    },
  };
};
