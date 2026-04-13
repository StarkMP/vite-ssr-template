# Vite SSR Template

Custom optimized SSR template built on React 19, Vite, and Fastify.

## Stack

- React 19 + TypeScript
- Vite
- Fastify
- tsup

## Features

- Streaming SSR via `renderToPipeableStream`
- Critical CSS inlining with [Beasties](https://github.com/danielroe/beasties)
- LRU HTML cache with request deduplication (thundering herd protection)
- Brotli compression for SSR responses and static assets
- ETag support for HTML
- Immutable cache headers for fingerprinted assets
- Graceful shutdown on `SIGTERM` / `SIGINT`

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm run preview
```

## Contributor

[StarkMP](https://github.com/starkmp)
