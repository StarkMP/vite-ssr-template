import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['server.ts'],
  format: ['esm'],
  outDir: 'dist/node',
  skipNodeModulesBundle: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
