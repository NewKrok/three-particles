import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM output (main library)
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    external: ['three'],
    treeshake: true,
  },
  // Minified browser bundle
  {
    entry: { 'three-particles.min': 'src/index.ts' },
    format: ['esm'],
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
    sourcemap: true,
    minify: 'terser',
    external: ['three'],
    treeshake: true,
    esbuildOptions(options) {
      options.drop = ['console'];
    },
  },
]);
