import { updateParticleSystems } from '../js/effects/three-particles/three-particles.js';

describe('updateParticleSystems', () => {
  it('should not throw error when called with valid parameters', () => {
    const mockCycleData = {
      now: 1000,
      delta: 16,
      elapsed: 1000,
    };

    expect(() => {
      updateParticleSystems(mockCycleData);
    }).not.toThrow();
  });
});
