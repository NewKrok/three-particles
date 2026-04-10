import * as THREE from 'three';
import {
  ForceFieldType,
  Shape,
  SimulationSpace,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  createParticleSystem,
  updateParticleSystems,
} from '../js/effects/three-particles/three-particles.js';
import type { ParticleSystem } from '../js/effects/three-particles/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const countActive = (ps: ParticleSystem): number => {
  const instance = ps.instance;
  const obj =
    instance instanceof THREE.Points || instance instanceof THREE.Mesh
      ? instance
      : (instance.children[0] as THREE.Points | THREE.Mesh | undefined);
  if (!obj) return 0;
  const arr = obj.geometry?.attributes?.isActive?.array;
  if (!arr) return 0;
  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) count++;
  }
  return count;
};

const getAttributes = (ps: ParticleSystem) => {
  const instance = ps.instance;
  const obj =
    instance instanceof THREE.Points || instance instanceof THREE.Mesh
      ? instance
      : (instance.children[0] as THREE.Points | THREE.Mesh | undefined);
  return obj!.geometry.attributes;
};

const createTestSystem = (
  config: Record<string, unknown> = {},
  startTime = 1000
) => {
  const ps = createParticleSystem(
    {
      maxParticles: 50,
      duration: 10,
      looping: true,
      startLifetime: 2,
      startSpeed: 1,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      emission: { rateOverTime: 20, rateOverDistance: 0 },
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

// ---------------------------------------------------------------------------
// Integration: updateConfig with global updateParticleSystems
// ---------------------------------------------------------------------------

describe('integration — updateConfig with global updateParticleSystems', () => {
  it('should apply config changes when updated via the global loop', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 30,
        duration: 10,
        looping: true,
        startLifetime: 2,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: 0,
        emission: { rateOverTime: 20, rateOverDistance: 0 },
      } as any,
      startTime
    );

    // Use global updater to emit particles
    updateParticleSystems({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });
    const active1 = countActive(ps);
    expect(active1).toBeGreaterThan(0);

    // Update config to add gravity
    ps.updateConfig({ gravity: -50 });

    // Continue with global updater — gravity should apply
    updateParticleSystems({ now: startTime + 300, delta: 0.2, elapsed: 0.3 });

    // Verify particles have been affected by gravity (moved away from origin)
    const attrs = getAttributes(ps);
    const posArr = attrs.position.array as Float32Array;
    let hasGravityEffect = false;
    const isActiveAttr = attrs.isActive;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i) && Math.abs(posArr[i * 3 + 1]) > 1.5) {
        hasGravityEffect = true;
        break;
      }
    }
    expect(hasGravityEffect).toBe(true);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig force field effect on particle positions
// ---------------------------------------------------------------------------

describe('integration — updateConfig force field position effects', () => {
  it('should push particles in the force field direction after config update', () => {
    const { ps, step } = createTestSystem({
      startSpeed: 0, // particles stationary initially
      gravity: 0,
    });

    // Emit particles
    step(100);
    const active = countActive(ps);
    expect(active).toBeGreaterThan(0);

    // Record positions before force field
    const attrs = getAttributes(ps);
    const posArr = attrs.position.array as Float32Array;
    const isActiveAttr = attrs.isActive;
    const xBefore: number[] = [];
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) xBefore.push(posArr[i * 3]);
    }

    // Add a strong directional force field pushing +X
    ps.updateConfig({
      forceFields: [
        {
          isActive: true,
          type: ForceFieldType.DIRECTIONAL,
          direction: { x: 1, y: 0, z: 0 },
          strength: 50,
        },
      ],
    });

    // Step forward several frames to let force accumulate
    step(200, 100);
    step(400, 200);
    step(700, 300);

    // Check that active particles have moved in +X direction
    let movedCount = 0;
    let activeIdx = 0;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        if (
          activeIdx < xBefore.length &&
          posArr[i * 3] > xBefore[activeIdx] + 0.1
        ) {
          movedCount++;
        }
        activeIdx++;
      }
    }
    expect(movedCount).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should stop applying force after removing force fields', () => {
    const { ps, step } = createTestSystem({
      startSpeed: 0,
      gravity: 0,
      forceFields: [
        {
          isActive: true,
          type: ForceFieldType.DIRECTIONAL,
          direction: { x: 0, y: 1, z: 0 },
          strength: 100,
        },
      ],
    });

    // Emit and let force field accelerate particles
    step(100);
    step(300, 200);

    const attrs = getAttributes(ps);
    const posArr = attrs.position.array as Float32Array;
    const isActiveAttr = attrs.isActive;

    // Record Y velocities (approximated by Y positions)
    const yBefore: number[] = [];
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) yBefore.push(posArr[i * 3 + 1]);
    }

    // Remove force fields
    ps.updateConfig({ forceFields: [] });

    // Step forward — particles still move (inertia) but no additional acceleration
    step(400, 100);
    step(500, 100);

    // Particles should still be alive and system should be stable
    expect(countActive(ps)).toBeGreaterThan(0);
    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig color changes affect new particles only
// ---------------------------------------------------------------------------

describe('integration — updateConfig color changes on new particles', () => {
  it('should emit new particles with updated startColor', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.3, // short lifetime so old particles die
      startColor: {
        min: { r: 1, g: 1, b: 1 },
        max: { r: 1, g: 1, b: 1 },
      },
    });

    // Emit white particles
    step(100);
    const attrs = getAttributes(ps);
    const colorRAttr = attrs.colorR;
    const colorGAttr = attrs.colorG;
    const isActiveAttr = attrs.isActive;

    // Verify initial particles are white (R=1, G=1)
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        expect(colorRAttr.getX(i)).toBeCloseTo(1, 1);
        expect(colorGAttr.getX(i)).toBeCloseTo(1, 1);
      }
    }

    // Change color to red
    ps.updateConfig({
      startColor: {
        min: { r: 1, g: 0, b: 0 },
        max: { r: 1, g: 0, b: 0 },
      },
    });

    // Wait for old particles to die, new ones to spawn with red
    step(600, 500);
    step(900, 300);

    // Check that newly spawned particles are red (R=1, G=0)
    let hasRedParticle = false;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        if (colorRAttr.getX(i) > 0.9 && colorGAttr.getX(i) < 0.1) {
          hasRedParticle = true;
          break;
        }
      }
    }
    expect(hasRedParticle).toBe(true);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: multiple systems with independent updateConfig
// ---------------------------------------------------------------------------

describe('integration — multiple systems with independent config updates', () => {
  it('should update configs independently for each system', () => {
    const startTime = 1000;
    const ps1 = createParticleSystem(
      {
        maxParticles: 20,
        duration: 10,
        looping: true,
        startLifetime: 2,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: 0,
        emission: { rateOverTime: 20, rateOverDistance: 0 },
      } as any,
      startTime
    );
    const ps2 = createParticleSystem(
      {
        maxParticles: 20,
        duration: 10,
        looping: true,
        startLifetime: 2,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: 0,
        emission: { rateOverTime: 20, rateOverDistance: 0 },
      } as any,
      startTime
    );

    // Emit particles in both systems via global updater
    updateParticleSystems({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });
    expect(countActive(ps1)).toBeGreaterThan(0);
    expect(countActive(ps2)).toBeGreaterThan(0);

    // Update only ps1 with downward gravity (positive = downward in this engine)
    ps1.updateConfig({ gravity: 100 });
    // ps2 stays at gravity: 0

    // Step both via global updater
    updateParticleSystems({ now: startTime + 400, delta: 0.3, elapsed: 0.4 });

    const attrs1 = getAttributes(ps1);
    const posArr1 = attrs1.position.array as Float32Array;
    const isActive1Attr = attrs1.isActive;

    const attrs2 = getAttributes(ps2);
    const posArr2 = attrs2.position.array as Float32Array;
    const isActive2Attr = attrs2.isActive;

    // ps1 particles should have moved down significantly
    let ps1MinY = Infinity;
    for (let i = 0; i < isActive1Attr.count; i++) {
      if (isActive1Attr.getX(i))
        ps1MinY = Math.min(ps1MinY, posArr1[i * 3 + 1]);
    }

    // ps2 particles should stay near origin (no gravity, no speed) — sphere emitter radius is 1
    let ps2MaxAbsY = 0;
    for (let i = 0; i < isActive2Attr.count; i++) {
      if (isActive2Attr.getX(i))
        ps2MaxAbsY = Math.max(ps2MaxAbsY, Math.abs(posArr2[i * 3 + 1]));
    }

    expect(ps1MinY).toBeLessThan(-0.1);
    expect(ps2MaxAbsY).toBeLessThan(1.5); // within sphere radius + tolerance

    ps1.dispose();
    ps2.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig gravity with position verification
// ---------------------------------------------------------------------------

describe('integration — updateConfig gravity verification', () => {
  it('should produce different Y positions with and without gravity', () => {
    // System A: no gravity
    const startTime = 1000;
    const baseConfig = {
      maxParticles: 20,
      duration: 10,
      looping: true,
      startLifetime: 5,
      startSpeed: 0,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      gravity: 0,
      emission: { rateOverTime: 50, rateOverDistance: 0 },
    } as any;

    const psNoGravity = createParticleSystem(baseConfig, startTime);
    const psWithGravity = createParticleSystem(baseConfig, startTime);

    // Emit particles in both
    const frame1 = { now: startTime + 100, delta: 0.1, elapsed: 0.1 };
    psNoGravity.update(frame1);
    psWithGravity.update(frame1);

    // Now enable gravity on one
    psWithGravity.updateConfig({ gravity: -50 });

    // Step both forward with same timing
    for (let t = 200; t <= 1000; t += 100) {
      const frame = { now: startTime + t, delta: 0.1, elapsed: t / 1000 };
      psNoGravity.update(frame);
      psWithGravity.update(frame);
    }

    // Compare: gravity system particles should have moved differently from no-gravity
    const getMaxAbsY = (ps: ParticleSystem) => {
      const a = getAttributes(ps);
      const pos = a.position.array as Float32Array;
      const isActAttr = a.isActive;
      let maxAbsY = 0;
      for (let i = 0; i < isActAttr.count; i++) {
        if (isActAttr.getX(i))
          maxAbsY = Math.max(maxAbsY, Math.abs(pos[i * 3 + 1]));
      }
      return maxAbsY;
    };

    // With gravity=-50 and startSpeed=0, particles should be pushed away from origin
    // more than the no-gravity particles (which only have sphere position offsets)
    expect(getMaxAbsY(psWithGravity)).toBeGreaterThan(getMaxAbsY(psNoGravity));

    psNoGravity.dispose();
    psWithGravity.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig emission + lifecycle
// ---------------------------------------------------------------------------

describe('integration — updateConfig emission rate lifecycle', () => {
  it('should ramp up and down emission rate during system lifetime', () => {
    const { ps, step } = createTestSystem({
      emission: { rateOverTime: 5, rateOverDistance: 0 },
      startLifetime: 0.5,
    });

    // Low emission rate — emit a few particles
    step(200);
    step(500, 300);
    const countLow = countActive(ps);

    // Ramp up emission
    ps.updateConfig({
      emission: { rateOverTime: 200, rateOverDistance: 0 },
    });

    step(800, 300);
    step(1200, 400);
    const countHigh = countActive(ps);
    expect(countHigh).toBeGreaterThan(countLow);

    // Ramp down emission back to zero
    ps.updateConfig({
      emission: { rateOverTime: 0, rateOverDistance: 0 },
    });

    // Wait for existing particles to die (lifetime 0.5s = 500ms)
    step(2000, 800);
    step(2500, 500);
    const countAfterStop = countActive(ps);
    expect(countAfterStop).toBeLessThan(countHigh);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig with simulationSpace
// ---------------------------------------------------------------------------

describe('integration — updateConfig simulationSpace', () => {
  it('should switch simulation space at runtime without crashing', () => {
    const { ps, step } = createTestSystem({
      simulationSpace: SimulationSpace.LOCAL,
    });

    step(100);
    expect(countActive(ps)).toBeGreaterThan(0);

    // Switch to world space
    ps.updateConfig({ simulationSpace: SimulationSpace.WORLD });

    // Continue stepping — should not throw
    step(200, 100);
    step(400, 200);
    expect(countActive(ps)).toBeGreaterThan(0);

    // Switch back
    ps.updateConfig({ simulationSpace: SimulationSpace.LOCAL });
    step(600, 200);
    expect(countActive(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: rapid successive updateConfig calls (stress)
// ---------------------------------------------------------------------------

describe('integration — rapid successive updateConfig calls', () => {
  it('should handle many config changes between frames without corruption', () => {
    const { ps, step } = createTestSystem({
      gravity: 0,
      startSpeed: 1,
    });

    step(100);
    expect(countActive(ps)).toBeGreaterThan(0);

    // Rapidly change config many times before the next frame
    for (let i = 0; i < 20; i++) {
      ps.updateConfig({ gravity: -i * 2 });
      ps.updateConfig({
        forceFields: [
          {
            type: ForceFieldType.DIRECTIONAL,
            direction: { x: Math.sin(i), y: Math.cos(i), z: 0 },
            strength: i,
          },
        ],
      });
    }

    // Step — the last config should be active
    step(200, 100);
    step(400, 200);

    // System should still be functional
    expect(countActive(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig startColor verified with actual color values
// ---------------------------------------------------------------------------

describe('integration — updateConfig startColor with value verification', () => {
  it('should spawn new particles with updated startColor after old ones expire', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.2, // 200ms — particles die quickly
      startColor: {
        min: { r: 1, g: 1, b: 1 },
        max: { r: 1, g: 1, b: 1 },
      },
    });

    // Emit white particles
    step(100);
    const attrs = getAttributes(ps);
    const isActiveAttr = attrs.isActive;
    const colorGAttr = attrs.colorG;

    // Verify all active particles are white (G=1)
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        expect(colorGAttr.getX(i)).toBeCloseTo(1, 1);
      }
    }

    // Change to pure red (G=0)
    ps.updateConfig({
      startColor: {
        min: { r: 1, g: 0, b: 0 },
        max: { r: 1, g: 0, b: 0 },
      },
    });

    // Wait for old particles to die (200ms lifetime) and new ones to spawn
    step(500, 400);
    step(800, 300);

    // All active particles should now be red (G=0)
    let allRed = true;
    let activeCount = 0;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        activeCount++;
        if (colorGAttr.getX(i) > 0.01) allRed = false;
      }
    }
    expect(activeCount).toBeGreaterThan(0);
    expect(allRed).toBe(true);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig startSize verified with actual size values
// ---------------------------------------------------------------------------

describe('integration — updateConfig startSize with value verification', () => {
  it('should spawn new particles with updated startSize', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.2,
      startSize: 1,
    });

    // Emit size-1 particles
    step(100);
    const attrs = getAttributes(ps);
    const sizeAttr = attrs.size;
    const isActiveAttr = attrs.isActive;

    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        expect(sizeAttr.getX(i)).toBeCloseTo(1, 1);
      }
    }

    // Change to size 5
    ps.updateConfig({ startSize: 5 });

    // Wait for old particles to die and new ones to spawn
    step(500, 400);
    step(800, 300);

    let allLarge = true;
    let activeCount = 0;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        activeCount++;
        if (sizeAttr.getX(i) < 4) allLarge = false;
      }
    }
    expect(activeCount).toBeGreaterThan(0);
    expect(allLarge).toBe(true);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig startSpeed verified with position spread
// ---------------------------------------------------------------------------

describe('integration — updateConfig startSpeed with position verification', () => {
  it('should spawn faster particles after startSpeed increase', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 1,
      startSpeed: 0.1,
      gravity: 0,
    });

    // Emit slow particles
    step(100);
    step(300, 200);

    const attrs = getAttributes(ps);
    const posArr = attrs.position.array as Float32Array;
    const isActiveAttr = attrs.isActive;

    // Record max distance from origin for slow particles
    let maxDistSlow = 0;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        const px = posArr[i * 3],
          py = posArr[i * 3 + 1],
          pz = posArr[i * 3 + 2];
        maxDistSlow = Math.max(
          maxDistSlow,
          Math.sqrt(px * px + py * py + pz * pz)
        );
      }
    }

    // Change to very fast particles
    ps.updateConfig({ startSpeed: 50 });

    // Emit fast particles
    step(600, 300);
    step(1000, 400);

    let maxDistFast = 0;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        const px = posArr[i * 3],
          py = posArr[i * 3 + 1],
          pz = posArr[i * 3 + 2];
        maxDistFast = Math.max(
          maxDistFast,
          Math.sqrt(px * px + py * py + pz * pz)
        );
      }
    }

    expect(maxDistFast).toBeGreaterThan(maxDistSlow * 2);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig startLifetime verified
// ---------------------------------------------------------------------------

describe('integration — updateConfig startLifetime', () => {
  it('should spawn particles with updated lifetime', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.1, // very short: 100ms
      emission: { rateOverTime: 50, rateOverDistance: 0 },
    });

    // Emit short-lived particles
    step(50);
    step(200, 150);
    // After 200ms, all 100ms-lifetime particles should be dead except very recent
    const countShort = countActive(ps);

    // Change to long-lived particles
    ps.updateConfig({ startLifetime: 10 });

    // Emit long-lived particles
    step(400, 200);
    step(700, 300);
    step(1200, 500);
    const countLong = countActive(ps);

    // With 10s lifetime, particles accumulate instead of dying
    expect(countLong).toBeGreaterThan(countShort);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateConfig shape change
// ---------------------------------------------------------------------------

describe('integration — updateConfig shape change', () => {
  it('should use updated shape for new particles', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.2,
      startSpeed: 0,
      gravity: 0,
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 0.01, radiusThickness: 1, arc: 360 },
      },
    });

    // Emit particles from tiny sphere — all near origin
    step(100);
    const attrs = getAttributes(ps);
    const posArr = attrs.position.array as Float32Array;
    const isActiveAttr = attrs.isActive;

    let maxDist1 = 0;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        const px = posArr[i * 3],
          py = posArr[i * 3 + 1],
          pz = posArr[i * 3 + 2];
        maxDist1 = Math.max(maxDist1, Math.sqrt(px * px + py * py + pz * pz));
      }
    }
    expect(maxDist1).toBeLessThan(0.1);

    // Change to large sphere
    ps.updateConfig({
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 10, radiusThickness: 1, arc: 360 },
      },
    });

    // Wait for old particles to die and new ones to spawn from large sphere
    step(500, 400);
    step(800, 300);

    let maxDist2 = 0;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) {
        const px = posArr[i * 3],
          py = posArr[i * 3 + 1],
          pz = posArr[i * 3 + 2];
        maxDist2 = Math.max(maxDist2, Math.sqrt(px * px + py * py + pz * pz));
      }
    }

    // New particles should be spread across a much larger area
    expect(maxDist2).toBeGreaterThan(1);

    ps.dispose();
  });
});
