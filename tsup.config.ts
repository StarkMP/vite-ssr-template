import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server/index.ts'],
  format: ['esm'],
  outDir: 'dist/node',
  skipNodeModulesBundle: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
