import { defineConfig } from 'tsup';

const sharedExternal = [
  'three',
  '@newkrok/three-utils',
  'easing-functions',
  'three-noise',
];

export default defineConfig([
  // ESM output (main library)
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    external: sharedExternal,
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
    external: sharedExternal,
    treeshake: true,
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
]);
