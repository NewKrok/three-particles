import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const threeExternals = [
  /^three$/,
  /^three\/tsl$/,
  /^three\/webgpu$/,
  "three/examples/jsm/misc/Gyroscope.js",
];

/**
 * Webpack config for the examples ESM bundles.
 * Bundles all dependencies EXCEPT three (resolved via importmap in the browser).
 * Unused three/examples/jsm/* imports from @newkrok/three-utils are replaced
 * with empty stubs to avoid loading unnecessary CDN modules.
 */
export default [
  // Main library bundle
  {
    entry: "./dist/index.js",
    output: {
      path: path.resolve(__dirname, "examples"),
      filename: "three-particles.esm.js",
      module: true,
      library: {
        type: "module",
      },
    },
    experiments: {
      outputModule: true,
    },
    mode: "production",
    resolve: {
      extensions: [".ts", ".js"],
      mainFields: ["module", "main"],
      alias: {
        // Stub out unused three-utils transitive imports with no-op constructors
        "three/examples/jsm/loaders/FBXLoader.js": path.resolve(
          __dirname,
          "scripts/stubs/three-loaders.js"
        ),
        "three/examples/jsm/loaders/GLTFLoader.js": path.resolve(
          __dirname,
          "scripts/stubs/three-loaders.js"
        ),
        "three/examples/jsm/helpers/PositionalAudioHelper.js": path.resolve(
          __dirname,
          "scripts/stubs/three-loaders.js"
        ),
      },
    },
    optimization: {
      usedExports: true,
      minimize: false,
    },
    externals: threeExternals,
  },
  // WebGPU add-on bundle (TSL material factories)
  {
    entry: "./dist/webgpu.js",
    output: {
      path: path.resolve(__dirname, "examples"),
      filename: "three-particles-webgpu.esm.js",
      module: true,
      library: {
        type: "module",
      },
    },
    experiments: {
      outputModule: true,
    },
    mode: "production",
    resolve: {
      extensions: [".ts", ".js"],
      mainFields: ["module", "main"],
    },
    optimization: {
      usedExports: true,
      minimize: false,
    },
    externals: threeExternals,
  },
];
