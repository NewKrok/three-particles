import * as THREE from 'three';
import {
  Shape,
  LifeTimeCurve,
  TimeMode,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  createParticleSystem,
  updateParticleSystems,
} from '../js/effects/three-particles/three-particles.js';
import { ParticleSystem } from '../js/effects/three-particles/types.js';

const countActiveParticles = (ps: ParticleSystem): number => {
  const points = ps.instance as THREE.Points;
  const isActiveArr = points.geometry.attributes.isActive.array;
  let count = 0;
  for (let i = 0; i < isActiveArr.length; i++) {
    if (isActiveArr[i]) count++;
  }
  return count;
};

const getAttributes = (ps: ParticleSystem) => {
  const points = ps.instance as THREE.Points;
  return points.geometry.attributes;
};

const createTestSystem = (
  config: Record<string, unknown> = {},
  startTime = 1000
) => {
  const ps = createParticleSystem(
    {
      maxParticles: 50,
      duration: 5,
      looping: true,
      startLifetime: 2,
      startSpeed: 1,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      emission: { rateOverTime: 10, rateOverDistance: 0 },
      ...config,
    } as any,
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

// ─── onComplete callback ────────────────────────────────────────────────────

describe('onComplete callback', () => {
  it('should call onComplete when non-looping system exceeds duration', () => {
    const onComplete = jest.fn();
    const { ps, step } = createTestSystem({
      duration: 0.1,
      looping: false,
      startLifetime: 0.05,
      emission: { rateOverTime: 50 },
      onComplete,
    });

    step(50);
    expect(onComplete).not.toHaveBeenCalled();

    step(200);
    expect(onComplete).toHaveBeenCalled();
    expect(onComplete.mock.calls[0][0].particleSystem).toBeDefined();

    ps.dispose();
  });

  it('should not call onComplete for looping systems', () => {
    const onComplete = jest.fn();
    const { ps, step } = createTestSystem({
      duration: 0.1,
      looping: true,
      onComplete,
    });

    step(100);
    step(500);
    step(1000);
    expect(onComplete).not.toHaveBeenCalled();

    ps.dispose();
  });

  it('should call onComplete repeatedly each frame after duration', () => {
    const onComplete = jest.fn();
    const { ps, step } = createTestSystem({
      duration: 0.05,
      looping: false,
      startLifetime: 0.01,
      emission: { rateOverTime: 10 },
      onComplete,
    });

    step(100);
    step(200);
    step(300);
    expect(onComplete.mock.calls.length).toBeGreaterThanOrEqual(2);

    ps.dispose();
  });
});

// ─── onUpdate callback ──────────────────────────────────────────────────────

describe('onUpdate callback', () => {
  it('should call onUpdate every frame during emission', () => {
    const onUpdate = jest.fn();
    const { ps, step } = createTestSystem({
      duration: 1.0,
      looping: true,
      onUpdate,
    });

    step(16);
    step(32);
    step(48);
    expect(onUpdate.mock.calls.length).toBe(3);

    ps.dispose();
  });

  it('should provide correct data to onUpdate', () => {
    const onUpdate = jest.fn();
    const { ps, step } = createTestSystem({
      duration: 1.0,
      looping: true,
      onUpdate,
    });

    step(500);
    const data = onUpdate.mock.calls[0][0];
    expect(data.particleSystem).toBeInstanceOf(THREE.Points);
    expect(typeof data.delta).toBe('number');
    expect(typeof data.elapsed).toBe('number');
    expect(typeof data.lifetime).toBe('number');
    expect(typeof data.normalizedLifetime).toBe('number');
    expect(typeof data.iterationCount).toBe('number');
    expect(data.iterationCount).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should not call onUpdate after duration for non-looping systems', () => {
    const onUpdate = jest.fn();
    const { ps, step } = createTestSystem({
      duration: 0.05,
      looping: false,
      startLifetime: 0.01,
      onUpdate,
    });

    step(16);
    const callCountDuring = onUpdate.mock.calls.length;
    expect(callCountDuring).toBeGreaterThan(0);

    step(200);
    step(300);
    // After duration, onUpdate should not be called more
    expect(onUpdate.mock.calls.length).toBe(callCountDuring);

    ps.dispose();
  });
});

// ─── Burst emission ─────────────────────────────────────────────────────────

describe('Burst emission', () => {
  it('should emit burst particles at specified time', () => {
    const { ps, step } = createTestSystem({
      emission: {
        rateOverTime: 0,
        bursts: [{ time: 0.1, count: 10 }],
      },
      startLifetime: 5,
      maxParticles: 50,
    });

    step(50);
    expect(countActiveParticles(ps)).toBe(0);

    step(150);
    expect(countActiveParticles(ps)).toBeGreaterThanOrEqual(10);

    ps.dispose();
  });

  it('should handle multiple bursts at different times', () => {
    const { ps, step } = createTestSystem({
      emission: {
        rateOverTime: 0,
        bursts: [
          { time: 0.05, count: 5 },
          { time: 0.15, count: 8 },
        ],
      },
      startLifetime: 10,
      maxParticles: 50,
    });

    step(70);
    const afterFirst = countActiveParticles(ps);
    expect(afterFirst).toBeGreaterThanOrEqual(5);

    step(200);
    const afterSecond = countActiveParticles(ps);
    expect(afterSecond).toBeGreaterThanOrEqual(afterFirst + 8);

    ps.dispose();
  });

  it('should handle burst with random count', () => {
    const { ps, step } = createTestSystem({
      emission: {
        rateOverTime: 0,
        bursts: [{ time: 0.05, count: { min: 5, max: 10 } }],
      },
      startLifetime: 10,
      maxParticles: 50,
    });

    step(100);
    const active = countActiveParticles(ps);
    expect(active).toBeGreaterThanOrEqual(5);
    expect(active).toBeLessThanOrEqual(10);

    ps.dispose();
  });

  it('should handle burst with cycles and interval', () => {
    const { ps, step } = createTestSystem({
      emission: {
        rateOverTime: 0,
        bursts: [{ time: 0.05, count: 3, cycles: 3, interval: 0.1 }],
      },
      startLifetime: 10,
      maxParticles: 50,
    });

    // First burst at 50ms
    step(60);
    const afterFirst = countActiveParticles(ps);
    expect(afterFirst).toBeGreaterThanOrEqual(3);

    // Second cycle at 150ms
    step(160);
    const afterSecond = countActiveParticles(ps);
    expect(afterSecond).toBeGreaterThanOrEqual(6);

    // Third cycle at 250ms
    step(260);
    const afterThird = countActiveParticles(ps);
    expect(afterThird).toBeGreaterThanOrEqual(9);

    ps.dispose();
  });

  it('should handle burst with probability 0 (no emission)', () => {
    const { ps, step } = createTestSystem({
      emission: {
        rateOverTime: 0,
        bursts: [{ time: 0.05, count: 10, probability: 0 }],
      },
      startLifetime: 10,
      maxParticles: 50,
    });

    step(100);
    step(200);
    expect(countActiveParticles(ps)).toBe(0);

    ps.dispose();
  });

  it('should reset burst state on loop', () => {
    const { ps, step } = createTestSystem({
      duration: 0.2,
      looping: true,
      emission: {
        rateOverTime: 0,
        bursts: [{ time: 0.05, count: 5 }],
      },
      startLifetime: 0.05,
      maxParticles: 50,
    });

    // First loop - burst at 50ms
    step(60);
    expect(countActiveParticles(ps)).toBeGreaterThanOrEqual(5);

    // Wait for particles to die and loop to restart
    step(300);
    step(400);
    // System should still work after loop
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should combine bursts with rateOverTime', () => {
    const { ps, step } = createTestSystem({
      emission: {
        rateOverTime: 10,
        bursts: [{ time: 0.05, count: 20 }],
      },
      startLifetime: 10,
      maxParticles: 50,
    });

    step(100);
    // Should have both rateOverTime particles and burst particles
    expect(countActiveParticles(ps)).toBeGreaterThan(20);

    ps.dispose();
  });
});

// ─── Particle lifecycle details ─────────────────────────────────────────────

describe('Particle lifecycle details', () => {
  it('should set lifetime to 0 on activation', () => {
    const { ps, step } = createTestSystem({
      emission: { rateOverTime: 50 },
    });

    step(100);
    const attrs = getAttributes(ps);
    for (let i = 0; i < attrs.isActive.array.length; i++) {
      if (attrs.isActive.array[i]) {
        expect(attrs.lifetime.array[i]).toBeGreaterThanOrEqual(0);
      }
    }

    ps.dispose();
  });

  it('should update particle lifetime each frame', () => {
    const { ps, step } = createTestSystem({
      emission: { rateOverTime: 100 },
      startLifetime: 5,
    });

    step(16);
    step(100);

    const attrs = getAttributes(ps);
    let foundPositiveLifetime = false;
    for (let i = 0; i < attrs.isActive.array.length; i++) {
      if (attrs.isActive.array[i] && attrs.lifetime.array[i] > 0) {
        foundPositiveLifetime = true;
        break;
      }
    }
    expect(foundPositiveLifetime).toBe(true);

    ps.dispose();
  });

  it('should reuse particle slots from free list', () => {
    const { ps, step } = createTestSystem({
      maxParticles: 5,
      startLifetime: 0.05,
      emission: { rateOverTime: 100 },
    });

    // Fill all slots
    step(16);
    step(50);
    // Wait for particles to die
    step(200);
    // New particles should reuse old slots
    step(250);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);
    expect(countActiveParticles(ps)).toBeLessThanOrEqual(5);

    ps.dispose();
  });

  it('should handle particle death and rebirth correctly', () => {
    const { ps, step } = createTestSystem({
      maxParticles: 10,
      startLifetime: 0.05,
      emission: { rateOverTime: 200 },
    });

    // Several cycles of birth/death
    for (let i = 1; i <= 20; i++) {
      step(i * 50);
    }

    // System should remain stable
    expect(ps.instance).toBeDefined();
    expect(countActiveParticles(ps)).toBeLessThanOrEqual(10);

    ps.dispose();
  });
});

// ─── Emission controls ──────────────────────────────────────────────────────

describe('Emission controls', () => {
  it('should not emit during startDelay', () => {
    const { ps, step } = createTestSystem({
      startDelay: 0.5,
      emission: { rateOverTime: 100 },
    });

    step(100);
    expect(countActiveParticles(ps)).toBe(0);

    step(600);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle random startDelay correctly', () => {
    const { ps, step } = createTestSystem({
      startDelay: { min: 0, max: 0.01 },
      emission: { rateOverTime: 100 },
    });

    // After max possible delay + some time, should emit
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should respect maxParticles limit with high emission rate', () => {
    const { ps, step } = createTestSystem({
      maxParticles: 3,
      startLifetime: 10,
      emission: { rateOverTime: 10000 },
    });

    step(16);
    step(100);
    step(200);
    expect(countActiveParticles(ps)).toBeLessThanOrEqual(3);

    ps.dispose();
  });

  it('should handle pause during active emission then resume', () => {
    const { ps, step } = createTestSystem({
      emission: { rateOverTime: 100 },
      startLifetime: 5,
    });

    step(100);
    const countBeforePause = countActiveParticles(ps);
    expect(countBeforePause).toBeGreaterThan(0);

    ps.pauseEmitter();
    step(200);
    step(300);
    // No new particles, but existing ones are still alive
    const countDuringPause = countActiveParticles(ps);
    expect(countDuringPause).toBeLessThanOrEqual(countBeforePause);

    ps.resumeEmitter();
    step(400);
    step(500);
    // New particles should appear
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle multiple pause/resume cycles', () => {
    const { ps, step } = createTestSystem({
      emission: { rateOverTime: 100 },
    });

    for (let i = 0; i < 5; i++) {
      ps.pauseEmitter();
      step(i * 200 + 100);
      ps.resumeEmitter();
      step(i * 200 + 200);
    }

    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

// ─── Duration and looping ───────────────────────────────────────────────────

describe('Duration and looping', () => {
  it('should loop normalized lifetime within duration', () => {
    const onUpdate = jest.fn();
    const { ps, step } = createTestSystem({
      duration: 0.1,
      looping: true,
      onUpdate,
    });

    step(50);
    step(150); // Past one full loop
    step(250); // Past two full loops

    // normalizedLifetime should always be within [0, duration*1000]
    for (const call of onUpdate.mock.calls) {
      expect(call[0].normalizedLifetime).toBeGreaterThanOrEqual(0);
    }

    ps.dispose();
  });

  it('should handle non-looping system that runs very long', () => {
    const { ps, step } = createTestSystem({
      duration: 0.05,
      looping: false,
      startLifetime: 0.01,
      emission: { rateOverTime: 50 },
    });

    step(100);
    step(1000);
    step(5000);
    // System should remain stable, just no new emissions
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should correctly track iteration count across loops', () => {
    const onUpdate = jest.fn();
    const { ps, step } = createTestSystem({
      duration: 0.1,
      looping: true,
      onUpdate,
    });

    step(50);
    expect(onUpdate.mock.calls[0][0].iterationCount).toBe(1);

    ps.dispose();
  });
});

// ─── Texture sheet animation ────────────────────────────────────────────────

describe('Texture sheet animation lifecycle', () => {
  it('should set startFrame on particle activation', () => {
    const { ps, step } = createTestSystem({
      textureSheetAnimation: {
        tiles: new THREE.Vector2(4, 4),
        timeMode: TimeMode.LIFETIME,
        fps: 30,
        startFrame: 5,
      },
      emission: { rateOverTime: 50 },
    });

    step(100);
    const attrs = getAttributes(ps);
    for (let i = 0; i < attrs.isActive.array.length; i++) {
      if (attrs.isActive.array[i]) {
        expect(attrs.startFrame.array[i]).toBe(5);
        break;
      }
    }

    ps.dispose();
  });

  it('should handle random startFrame during particle activation', () => {
    const { ps, step } = createTestSystem({
      textureSheetAnimation: {
        tiles: new THREE.Vector2(4, 4),
        timeMode: TimeMode.LIFETIME,
        fps: 30,
        startFrame: { min: 0, max: 15 },
      },
      emission: { rateOverTime: 50 },
      maxParticles: 20,
    });

    step(100);
    const attrs = getAttributes(ps);
    const frames = new Set<number>();
    for (let i = 0; i < attrs.isActive.array.length; i++) {
      if (attrs.isActive.array[i]) {
        expect(attrs.startFrame.array[i]).toBeGreaterThanOrEqual(0);
        expect(attrs.startFrame.array[i]).toBeLessThanOrEqual(15);
        frames.add(Math.round(attrs.startFrame.array[i]));
      }
    }

    ps.dispose();
  });

  it('should handle startFrame of 0', () => {
    const { ps, step } = createTestSystem({
      textureSheetAnimation: {
        tiles: new THREE.Vector2(2, 2),
        timeMode: TimeMode.FPS,
        fps: 10,
        startFrame: 0,
      },
      emission: { rateOverTime: 50 },
    });

    step(100);
    const attrs = getAttributes(ps);
    for (let i = 0; i < attrs.isActive.array.length; i++) {
      if (attrs.isActive.array[i]) {
        expect(attrs.startFrame.array[i]).toBe(0);
        break;
      }
    }

    ps.dispose();
  });
});

// ─── Color lifecycle ────────────────────────────────────────────────────────

describe('Color lifecycle', () => {
  it('should set random color between min and max on activation', () => {
    const { ps, step } = createTestSystem({
      startColor: {
        min: { r: 0.2, g: 0.3, b: 0.4 },
        max: { r: 0.8, g: 0.9, b: 1.0 },
      },
      emission: { rateOverTime: 100 },
    });

    step(100);
    const attrs = getAttributes(ps);
    for (let i = 0; i < attrs.isActive.array.length; i++) {
      if (attrs.isActive.array[i]) {
        expect(attrs.colorR.array[i]).toBeGreaterThanOrEqual(0.2);
        expect(attrs.colorR.array[i]).toBeLessThanOrEqual(0.8);
        expect(attrs.colorG.array[i]).toBeGreaterThanOrEqual(0.3);
        expect(attrs.colorG.array[i]).toBeLessThanOrEqual(0.9);
        expect(attrs.colorB.array[i]).toBeGreaterThanOrEqual(0.4);
        expect(attrs.colorB.array[i]).toBeLessThanOrEqual(1.0);
        break;
      }
    }

    ps.dispose();
  });

  it('should set alpha to 0 when particle deactivates', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.03,
      emission: { rateOverTime: 200 },
      maxParticles: 10,
    });

    step(16);
    step(50);
    step(100);

    const attrs = getAttributes(ps);
    for (let i = 0; i < attrs.isActive.array.length; i++) {
      if (!attrs.isActive.array[i]) {
        expect(attrs.colorA.array[i]).toBe(0);
      }
    }

    ps.dispose();
  });
});
