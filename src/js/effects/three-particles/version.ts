/**
 * The semver version of `@newkrok/three-particles`, injected at build time
 * from `package.json` via `tsup`'s `define` option (see `tsup.config.ts`).
 *
 * Exposed for runtime introspection (debugging, bug reports). Mirrors the
 * three.js `REVISION` + `window.__THREE__` pattern.
 *
 * In test environments (jest/ts-jest) the build-time define isn't applied,
 * so `__THREE_PARTICLES_VERSION__` is undefined; we fall back to `'0.0.0-dev'`
 * so imports don't throw.
 */
declare const __THREE_PARTICLES_VERSION__: string;

export const REVISION: string =
  typeof __THREE_PARTICLES_VERSION__ !== 'undefined'
    ? __THREE_PARTICLES_VERSION__
    : '0.0.0-dev';

if (typeof globalThis !== 'undefined') {
  const g = globalThis as { __THREE_PARTICLES__?: string };
  if (g.__THREE_PARTICLES__ && g.__THREE_PARTICLES__ !== REVISION) {
    // eslint-disable-next-line no-console
    console.warn(
      'WARNING: Multiple instances of @newkrok/three-particles being imported.'
    );
  } else {
    g.__THREE_PARTICLES__ = REVISION;
  }
}
