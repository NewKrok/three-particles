import { defineConfig } from 'tsup';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const libraryExternal = [
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
    external: libraryExternal,
    treeshake: true,
  },
  // Minified browser bundle — all deps except "three" are inlined so the
  // bundle works when loaded directly from a CDN without a bundler.
  {
    entry: { 'three-particles.min': 'src/index.ts' },
    format: ['esm'],
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
    sourcemap: true,
    minify: 'terser',
    noExternal: [/.*/],
    treeshake: true,
    esbuildPlugins: [
      {
        // Handle three.js externals for the browser bundle:
        // - "three" core and Gyroscope (actually used) → external
        // - Unused loaders/helpers from @newkrok/three-utils → stubbed
        name: 'three-browser-externals',
        setup(build) {
          const stub = path.resolve(__dirname, 'scripts/stubs/three-loaders.js');
          const stubbed = new Set([
            'three/examples/jsm/loaders/FBXLoader.js',
            'three/examples/jsm/loaders/GLTFLoader.js',
            'three/examples/jsm/helpers/PositionalAudioHelper.js',
            'three/examples/jsm/utils/SkeletonUtils.js',
          ]);
          const kept = new Set([
            'three',
            'three/examples/jsm/misc/Gyroscope.js',
          ]);
          build.onResolve({ filter: /^three(\/|$)/ }, (args) => {
            if (stubbed.has(args.path)) {
              return { path: stub };
            }
            if (kept.has(args.path)) {
              return { path: args.path, external: true };
            }
            // Any other three/* import — keep external
            return { path: args.path, external: true };
          });
        },
      },
    ],
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
]);
