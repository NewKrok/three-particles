import { defineConfig } from 'tsup';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')
) as { version: string };

const defineConstants = {
  __THREE_PARTICLES_VERSION__: JSON.stringify(pkg.version),
};

const libraryExternal = [
  'three',
  '@newkrok/three-utils',
  'easing-functions',
  'three-noise',
  'three/tsl',
  'three/webgpu',
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
    define: defineConstants,
  },
  // WebGPU entry point (TSL material factories)
  // DTS is hand-written (webgpu.d.ts) because TSL node types resolve to
  // `unknown` which breaks automatic declaration generation.
  //
  // '@newkrok/three-particles' (self-reference) MUST be external so that
  // `registerTSLMaterialFactory` resolves to the same module instance as the
  // main entry point at runtime. Without this, the webgpu bundle gets its own
  // copy of `_tslMaterialFactory` — writes from `enableWebGPU()` would never
  // be visible to `createParticleSystem` in the main bundle, AND Rollup
  // treeshake correctly removes the body as dead code within the isolated bundle.
  {
    entry: { webgpu: 'src/webgpu.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    outDir: 'dist',
    external: [...libraryExternal, '@newkrok/three-particles'],
    treeshake: true,
    define: defineConstants,
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
    define: defineConstants,
  },
]);
