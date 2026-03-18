import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import { ParticleSystem } from '../js/effects/three-particles/types.js';

/**
 * Helper: count active particles by reading the isActive buffer attribute.
 */
const countActiveParticles = (ps: ParticleSystem): number => {
  const points = ps.instance as THREE.Points;
  const isActiveArr = points.geometry.attributes.isActive.array;
  let count = 0;
  for (let i = 0; i < isActiveArr.length; i++) {
    if (isActiveArr[i]) count++;
  }
  return count;
};

/**
 * Helper: create a particle system with rateOverDistance emission only.
 */
const createDistanceTestSystem = (
  rateOverDistance: number,
  options: { maxParticles?: number; duration?: number; looping?: boolean } = {}
) => {
  const startTime = 1000;
  const ps = createParticleSystem(
    {
      emission: {
        rateOverTime: 0,
        rateOverDistance,
      },
      maxParticles: options.maxParticles ?? 200,
      duration: options.duration ?? 10,
      looping: options.looping ?? true,
      startLifetime: 10,
      startSpeed: 0,
    },
    startTime
  );

  const step = (timeOffsetMs: number, deltaMs: number = 16) => {
    ps.update({
      now: startTime + timeOffsetMs,
      delta: deltaMs / 1000,
      elapsed: timeOffsetMs / 1000,
    });
  };

  return { ps, step, startTime };
};

describe('Rate Over Distance - Pause/Resume', () => {
  it('should emit particles when moving with rateOverDistance', () => {
    const { ps, step } = createDistanceTestSystem(1);
    const instance = ps.instance as THREE.Points;

    // First frame to initialize lastWorldPosition
    step(16);

    // Move 10 units and update
    instance.position.x = 10;
    step(32);

    const active = countActiveParticles(ps);
    expect(active).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should not accumulate distance while paused', () => {
    const { ps, step } = createDistanceTestSystem(1);
    const instance = ps.instance as THREE.Points;

    // First frame to initialize lastWorldPosition
    step(16);

    // Move a bit to establish baseline
    instance.position.x = 2;
    step(32);
    const activeBeforePause = countActiveParticles(ps);

    // Pause emitter
    ps.pauseEmitter();

    // Move a large distance while paused (simulating car driving between drifts)
    instance.position.x = 1000;
    step(48);

    // Resume emitter
    ps.resumeEmitter();

    // Small movement after resume
    instance.position.x = 1001;
    step(64);

    const activeAfterResume = countActiveParticles(ps);
    // The particles emitted after resume should only reflect the small movement (1 unit),
    // not the large distance traveled while paused (998 units)
    const emittedAfterResume = activeAfterResume - activeBeforePause;
    expect(emittedAfterResume).toBeLessThanOrEqual(2);

    ps.dispose();
  });

  it('should not burst emit on resume after pause', () => {
    const { ps, step } = createDistanceTestSystem(10);
    const instance = ps.instance as THREE.Points;

    // Initialize
    step(16);

    // Pause
    ps.pauseEmitter();

    // Move far while paused
    instance.position.x = 100;
    step(32);
    instance.position.x = 200;
    step(48);

    const activeWhilePaused = countActiveParticles(ps);
    expect(activeWhilePaused).toBe(0);

    // Resume and move just 1 unit
    ps.resumeEmitter();
    instance.position.x = 201;
    step(64);

    const activeAfterResume = countActiveParticles(ps);
    // With rateOverDistance=10, moving 1 unit should emit ~10 particles, not hundreds
    expect(activeAfterResume).toBeLessThanOrEqual(11);

    ps.dispose();
  });

  it('should resume normal distance emission after unpause', () => {
    const { ps, step } = createDistanceTestSystem(1);
    const instance = ps.instance as THREE.Points;

    // Initialize
    step(16);

    // Pause and move far
    ps.pauseEmitter();
    instance.position.x = 500;
    step(32);

    // Resume
    ps.resumeEmitter();

    // Move 5 units - should emit ~5 particles
    instance.position.x = 505;
    step(48);

    const active = countActiveParticles(ps);
    expect(active).toBeGreaterThanOrEqual(1);
    expect(active).toBeLessThanOrEqual(6);

    ps.dispose();
  });
});
