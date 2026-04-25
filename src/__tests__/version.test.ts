/**
 * Runtime version exposure.
 *
 * The library mirrors the three.js `REVISION` + `window.__THREE__` pattern so
 * consumers can introspect the loaded version at runtime (bug reports,
 * compatibility checks).
 *
 * The version string is injected at build time by `tsup`'s `define` option
 * (see `tsup.config.ts`). In test environments jest's `ts-jest` transform
 * does not see that define, so `__THREE_PARTICLES_VERSION__` is undefined and
 * `REVISION` comes out as the string "undefined". The tests below therefore
 * only validate the surface shape, not the exact version string.
 */

describe('version exposure', () => {
  it('exports a `REVISION` string from the main entry', async () => {
    const mod = await import('../index.js');
    expect(typeof mod.REVISION).toBe('string');
  });

  it('sets `globalThis.__THREE_PARTICLES__` on import', async () => {
    // Fresh import — module side effect runs on first load.
    const g = globalThis as { __THREE_PARTICLES__?: string };
    delete g.__THREE_PARTICLES__;
    jest.resetModules();
    await import('../index.js');
    expect(typeof g.__THREE_PARTICLES__).toBe('string');
  });
});
