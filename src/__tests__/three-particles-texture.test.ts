import { createDefaultParticleTexture } from '../js/effects/three-particles/three-particles-utils.js';

describe('createDefaultParticleTexture', () => {
  it('should return null in non-browser environment (no document)', () => {
    // In Node.js test environment without jsdom, document is not defined
    // The function catches the error and returns null
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const texture = createDefaultParticleTexture();

    // In a no-DOM environment, this should return null due to the try/catch
    expect(texture).toBeNull();

    warnSpy.mockRestore();
  });
});
