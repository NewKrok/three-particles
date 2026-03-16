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
 * Helper: create a particle system with no time-based emission (rateOverTime=0)
 * so only bursts produce particles, then return the system and a step function.
 */
const createBurstTestSystem = (
  bursts: Array<{
    time: number;
    count: number | { min: number; max: number };
    cycles?: number;
    interval?: number;
    probability?: number;
  }>,
  options: { maxParticles?: number; duration?: number; looping?: boolean } = {}
) => {
  const startTime = 1000;
  const ps = createParticleSystem(
    {
      emission: {
        rateOverTime: 0,
        rateOverDistance: 0,
        bursts,
      },
      maxParticles: options.maxParticles ?? 200,
      duration: options.duration ?? 5,
      looping: options.looping ?? false,
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

describe('Burst Emission', () => {
  it('should emit particles at burst time', () => {
    const { ps, step } = createBurstTestSystem([{ time: 0.5, count: 10 }]);

    // Before burst time — no particles from bursts
    step(100);
    expect(countActiveParticles(ps)).toBe(0);

    // At burst time (500ms) — should emit 10 particles
    step(500);
    const active = countActiveParticles(ps);
    expect(active).toBe(10);

    ps.dispose();
  });

  it('should emit at time 0', () => {
    const { ps, step } = createBurstTestSystem([{ time: 0, count: 5 }]);

    step(16);
    expect(countActiveParticles(ps)).toBe(5);

    ps.dispose();
  });

  it('should handle multiple bursts at different times', () => {
    const { ps, step } = createBurstTestSystem([
      { time: 0.1, count: 3 },
      { time: 0.5, count: 7 },
    ]);

    // After first burst
    step(100);
    expect(countActiveParticles(ps)).toBe(3);

    // After second burst
    step(500);
    expect(countActiveParticles(ps)).toBe(10); // 3 + 7

    ps.dispose();
  });

  it('should support multi-cycle bursts with interval', () => {
    const { ps, step } = createBurstTestSystem([
      { time: 0.1, count: 5, cycles: 3, interval: 0.2 },
    ]);

    // First cycle at 100ms
    step(100);
    expect(countActiveParticles(ps)).toBe(5);

    // Second cycle at 300ms (100 + 200)
    step(300);
    expect(countActiveParticles(ps)).toBe(10);

    // Third cycle at 500ms (100 + 400)
    step(500);
    expect(countActiveParticles(ps)).toBe(15);

    // No more cycles after 3
    step(700);
    expect(countActiveParticles(ps)).toBe(15);

    ps.dispose();
  });

  it('should not exceed maxParticles', () => {
    const { ps, step } = createBurstTestSystem([{ time: 0, count: 50 }], {
      maxParticles: 10,
    });

    step(16);
    expect(countActiveParticles(ps)).toBeLessThanOrEqual(10);

    ps.dispose();
  });

  it('should not emit when probability is 0', () => {
    const { ps, step } = createBurstTestSystem([
      { time: 0, count: 20, probability: 0 },
    ]);

    step(16);
    expect(countActiveParticles(ps)).toBe(0);

    ps.dispose();
  });

  it('should always emit when probability is 1', () => {
    const { ps, step } = createBurstTestSystem([
      { time: 0, count: 10, probability: 1 },
    ]);

    step(16);
    expect(countActiveParticles(ps)).toBe(10);

    ps.dispose();
  });

  it('should handle random count range', () => {
    const { ps, step } = createBurstTestSystem([
      { time: 0, count: { min: 5, max: 15 } },
    ]);

    step(16);
    const active = countActiveParticles(ps);
    expect(active).toBeGreaterThanOrEqual(5);
    expect(active).toBeLessThanOrEqual(15);

    ps.dispose();
  });

  it('should not emit burst before its time', () => {
    const { ps, step } = createBurstTestSystem([{ time: 2.0, count: 10 }]);

    step(500);
    expect(countActiveParticles(ps)).toBe(0);

    step(1999);
    expect(countActiveParticles(ps)).toBe(0);

    step(2000);
    expect(countActiveParticles(ps)).toBe(10);

    ps.dispose();
  });

  it('should reset burst states on loop', () => {
    const { ps, step } = createBurstTestSystem([{ time: 0.1, count: 5 }], {
      duration: 1,
      looping: true,
    });

    // First iteration: burst at 100ms
    step(100);
    expect(countActiveParticles(ps)).toBe(5);

    // Second iteration: normalizedLifetime wraps around to ~16ms (< burstTime),
    // which triggers burst state reset
    step(1016);
    expect(countActiveParticles(ps)).toBe(5); // reset happened, but not yet at burst time

    // Now at 1100ms, normalizedLifetime = 100ms = burstTime, burst fires again
    step(1100);
    expect(countActiveParticles(ps)).toBe(10);

    ps.dispose();
  });

  it('should not emit bursts after duration in non-looping mode', () => {
    const { ps, step } = createBurstTestSystem([{ time: 0.1, count: 5 }], {
      duration: 1,
      looping: false,
    });

    // First burst fires
    step(100);
    expect(countActiveParticles(ps)).toBe(5);

    // After duration (1s), no more emission
    step(1500);
    expect(countActiveParticles(ps)).toBe(5); // same count, no new particles

    ps.dispose();
  });

  it('should handle burst with cycles=1 (default behavior)', () => {
    const { ps, step } = createBurstTestSystem([
      { time: 0.1, count: 8, cycles: 1 },
    ]);

    step(100);
    expect(countActiveParticles(ps)).toBe(8);

    // No second emission even with more time
    step(500);
    expect(countActiveParticles(ps)).toBe(8);

    ps.dispose();
  });
});
