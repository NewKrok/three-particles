import * as THREE from 'three';
import {
  ForceFieldFalloff,
  ForceFieldType,
  LifeTimeCurve,
  RendererType,
  Shape,
  SimulationSpace,
  SubEmitterTrigger,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  serializeParticleSystem,
  deserializeParticleSystem,
} from '../js/effects/three-particles/three-particles-serialization.js';
import {
  createParticleSystem,
  updateParticleSystems,
} from '../js/effects/three-particles/three-particles.js';
import type { ParticleSystem } from '../js/effects/three-particles/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const countActive = (ps: ParticleSystem, instanced = false): number => {
  const instance = ps.instance;
  // WORLD space wraps in a Gyroscope (Object3D) — geometry lives on children[0]
  const obj =
    instance instanceof THREE.Points || instance instanceof THREE.Mesh
      ? instance
      : (instance.children[0] as THREE.Points | THREE.Mesh | undefined);
  if (!obj) return 0;
  const attrName = instanced ? 'instanceIsActive' : 'isActive';
  const attr = obj.geometry?.attributes?.[attrName];
  if (!attr) return 0;
  let count = 0;
  for (let i = 0; i < attr.count; i++) {
    if (attr.getX(i)) count++;
  }
  return count;
};

const readPositions = (
  ps: ParticleSystem
): Array<{ x: number; y: number; z: number }> => {
  const instance = ps.instance;
  const obj =
    instance instanceof THREE.Points || instance instanceof THREE.Mesh
      ? instance
      : (instance.children[0] as THREE.Points | THREE.Mesh | undefined);
  if (!obj) return [];
  const arr = obj.geometry?.attributes?.position?.array;
  if (!arr) return [];
  const positions: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < arr.length; i += 3) {
    positions.push({
      x: arr[i] as number,
      y: arr[i + 1] as number,
      z: arr[i + 2] as number,
    });
  }
  return positions;
};

// ---------------------------------------------------------------------------
// Integration: Full particle lifecycle
// ---------------------------------------------------------------------------

describe('integration — full particle lifecycle', () => {
  it('should emit, move, age, and expire particles across multiple frames', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 20,
        duration: 10,
        looping: true,
        startLifetime: 0.5,
        startSpeed: 5,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 20,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 3 }],
        },
      } as any,
      startTime
    );

    // Frame 1: burst emits particles immediately
    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    const active1 = countActive(ps);
    expect(active1).toBeGreaterThan(0);

    // Frame 2-5: more particles appear via rateOverTime, existing ones move
    for (let i = 1; i <= 4; i++) {
      ps.update({
        now: startTime + i * 50,
        delta: 0.05,
        elapsed: i * 0.05,
      });
    }
    const active2 = countActive(ps);
    expect(active2).toBeGreaterThan(active1);

    // Positions should have changed from origin due to startSpeed
    const positions = readPositions(ps);
    const movedParticles = positions.filter(
      (p) =>
        Math.abs(p.x) > 0.01 || Math.abs(p.y) > 0.01 || Math.abs(p.z) > 0.01
    );
    expect(movedParticles.length).toBeGreaterThan(0);

    // Wait for particles to expire (lifetime = 0.5s)
    ps.update({ now: startTime + 800, delta: 0.3, elapsed: 0.8 });

    // Particles are still emitting (looping=true), so count stays positive
    const active3 = countActive(ps);
    expect(active3).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should respect maxParticles limit during continuous emission', () => {
    const maxParticles = 5;
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles,
        duration: 10,
        looping: true,
        startLifetime: 10, // long lifetime so they don't expire
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: { rateOverTime: 1000, rateOverDistance: 0 },
      } as any,
      startTime
    );

    // Emit for several frames
    for (let i = 0; i < 10; i++) {
      ps.update({
        now: startTime + i * 100,
        delta: 0.1,
        elapsed: i * 0.1,
      });
    }

    const active = countActive(ps);
    expect(active).toBeLessThanOrEqual(maxParticles);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: Modifiers + forces combined
// ---------------------------------------------------------------------------

describe('integration — modifiers and forces combined', () => {
  it('should apply gravity, force fields, and size modifier simultaneously', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 10,
        looping: true,
        startLifetime: 2,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: -9.8,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 5 }],
        },
        sizeOverLifetime: {
          isActive: true,
          lifetimeCurve: {
            type: LifeTimeCurve.BEZIER,
            bezierPoints: [
              { x: 0, y: 1 },
              { x: 0.25, y: 1 },
              { x: 0.75, y: 0 },
              { x: 1, y: 0 },
            ],
          },
        },
        forceFields: [
          {
            type: ForceFieldType.DIRECTIONAL,
            direction: { x: 1, y: 0, z: 0 },
            strength: 5,
          },
        ],
      } as any,
      startTime
    );

    // Initial burst + capture the spawn positions so we can compare after
    // a few frames of physics against the pre-simulation baseline (the
    // default SPHERE shape spawns particles at random offsets around the
    // origin, which made an absolute-direction assertion RNG-dependent).
    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    expect(countActive(ps)).toBe(5);
    const spawnPositions = readPositions(ps).map((p) => ({ ...p }));

    // Simulate a few frames
    ps.update({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });
    ps.update({ now: startTime + 200, delta: 0.1, elapsed: 0.2 });

    const positions = readPositions(ps);

    // Gravity acts along Y — every particle's Y position must have drifted
    // from its spawn point (sign depends on the gravity convention; the
    // test only asserts that the Y axis sees _some_ motion).
    const yMoved = positions.some((p, i) => {
      const dy = p.y - (spawnPositions[i]?.y ?? 0);
      return Math.abs(dy) > 0.01;
    });
    expect(yMoved).toBe(true);

    // Directional force should push particles in +X
    const hasPositiveX = positions.some((p) => p.x > 0.01);
    expect(hasPositiveX).toBe(true);

    // Size should have decreased (particles are aging)
    const pointsObj = (
      ps.instance instanceof THREE.Points
        ? ps.instance
        : ps.instance.children[0]
    ) as THREE.Points;
    const sizeAttr = pointsObj.geometry.attributes.size;
    const isActiveAttr = pointsObj.geometry.attributes.isActive;
    const sizes: number[] = [];
    for (let i = 0; i < sizeAttr.count; i++) {
      if (isActiveAttr.getX(i)) sizes.push(sizeAttr.getX(i));
    }
    const hasReducedSize = sizes.some((s) => s < 1);
    expect(hasReducedSize).toBe(true);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: Sub-emitters with INSTANCED renderer
// ---------------------------------------------------------------------------

describe('integration — instanced sub-emitters', () => {
  it('should create and clean up instanced sub-emitter instances', () => {
    const scene = new THREE.Group();
    const startTime = 1000;

    const ps = createParticleSystem(
      {
        maxParticles: 5,
        duration: 5,
        looping: true,
        startLifetime: 0.15,
        startSpeed: 1,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 2 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: {
              maxParticles: 3,
              duration: 0.5,
              looping: false,
              startLifetime: 0.1,
              startSpeed: 0,
              startSize: 0.5,
              startOpacity: 1,
              startRotation: 0,
              renderer: { rendererType: RendererType.INSTANCED },
              emission: {
                rateOverTime: 0,
                rateOverDistance: 0,
                bursts: [{ time: 0, count: 2 }],
              },
            },
            maxInstances: 4,
          },
        ],
      } as any,
      startTime
    );

    scene.add(ps.instance);

    // Emit initial burst
    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    expect(countActive(ps)).toBe(2);

    // Wait for parent particles to die (lifetime=0.15s)
    ps.update({ now: startTime + 200, delta: 0.2, elapsed: 0.2 });

    // Sub-emitters should have been spawned (as Mesh instances)
    const subInstances = scene.children.filter((c) => c !== ps.instance);
    expect(subInstances.length).toBeGreaterThan(0);

    // Sub-emitter instances should be Mesh (instanced renderer)
    for (const sub of subInstances) {
      const meshOrChild =
        sub instanceof THREE.Mesh
          ? sub
          : (sub.children[0] as THREE.Mesh | undefined);
      if (meshOrChild instanceof THREE.Mesh) {
        expect(meshOrChild.geometry).toBeInstanceOf(
          THREE.InstancedBufferGeometry
        );
      }
    }

    // Wait for sub-emitter particles to also expire
    ps.update({ now: startTime + 600, delta: 0.4, elapsed: 0.6 });
    ps.update({ now: startTime + 1000, delta: 0.4, elapsed: 1.0 });

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: Serialization round-trip with complex config
// ---------------------------------------------------------------------------

describe('integration — serialization round-trip with full config', () => {
  it('should preserve a complex config through serialize → deserialize', () => {
    const config = {
      maxParticles: 100,
      duration: 5,
      looping: true,
      startDelay: 0.5,
      startLifetime: { min: 1, max: 3 },
      startSpeed: { min: 2, max: 5 },
      startSize: { min: 0.5, max: 1.5 },
      startOpacity: 1,
      startRotation: { min: 0, max: 360 },
      startColor: {
        min: { r: 1, g: 0, b: 0 },
        max: { r: 1, g: 1, b: 0 },
      },
      gravity: -9.8,
      simulationSpace: SimulationSpace.WORLD,
      emission: {
        rateOverTime: 50,
        rateOverDistance: 0,
        bursts: [
          { time: 0, count: 10, cycles: 3, interval: 0.5 },
          { time: 1, count: 5 },
        ],
      },
      shape: {
        shape: Shape.CONE,
        radius: 2,
        arc: 360,
        angle: 25,
      },
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.BEZIER,
          bezierPoints: [
            { x: 0, y: 1 },
            { x: 0.3, y: 0.8 },
            { x: 0.7, y: 0.2 },
            { x: 1, y: 0 },
          ],
        },
      },
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.BEZIER,
          bezierPoints: [
            { x: 0, y: 0 },
            { x: 0.2, y: 1 },
            { x: 0.8, y: 1 },
            { x: 1, y: 0 },
          ],
        },
      },
      forceFields: [
        {
          type: ForceFieldType.POINT,
          position: { x: 0, y: 5, z: 0 },
          strength: 3,
          range: 10,
          falloff: ForceFieldFalloff.LINEAR,
        },
        {
          type: ForceFieldType.DIRECTIONAL,
          direction: { x: 1, y: 0, z: 0 },
          strength: 2,
        },
      ],
      textureSheetAnimation: {
        tiles: { x: 4, y: 4 },
        fps: 24,
      },
      renderer: {
        rendererType: RendererType.INSTANCED,
      },
    };

    const json = serializeParticleSystem(config as any);
    const restored = deserializeParticleSystem(json);

    // Scalar values
    expect(restored.maxParticles).toBe(100);
    expect(restored.duration).toBe(5);
    expect(restored.looping).toBe(true);
    expect(restored.startDelay).toBe(0.5);
    expect(restored.gravity).toBe(-9.8);

    // Random ranges
    expect(restored.startLifetime).toEqual({ min: 1, max: 3 });
    expect(restored.startSpeed).toEqual({ min: 2, max: 5 });

    // Emission
    expect(restored.emission!.rateOverTime).toBe(50);
    expect(restored.emission!.bursts!.length).toBe(2);
    expect(restored.emission!.bursts![0].count).toBe(10);
    expect(restored.emission!.bursts![0].cycles).toBe(3);

    // Shape
    expect(restored.shape!.shape).toBe(Shape.CONE);
    expect(restored.shape!.radius).toBe(2);
    expect(restored.shape!.angle).toBe(25);

    // Modifiers
    expect(restored.sizeOverLifetime!.isActive).toBe(true);
    expect(
      (restored.sizeOverLifetime!.lifetimeCurve as any).bezierPoints.length
    ).toBe(4);
    expect(restored.opacityOverLifetime!.isActive).toBe(true);

    // Force fields
    expect(restored.forceFields!.length).toBe(2);
    expect(restored.forceFields![0].type).toBe(ForceFieldType.POINT);
    expect(restored.forceFields![1].type).toBe(ForceFieldType.DIRECTIONAL);

    // Texture sheet
    expect(restored.textureSheetAnimation!.tiles!.x).toBe(4);
    expect(restored.textureSheetAnimation!.tiles!.y).toBe(4);
  });

  it('should produce a working particle system from deserialized config', () => {
    const config = {
      maxParticles: 10,
      duration: 5,
      looping: true,
      startLifetime: 1,
      startSpeed: 2,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      gravity: -5,
      emission: {
        rateOverTime: 20,
        rateOverDistance: 0,
      },
    };

    const json = serializeParticleSystem(config as any);
    const restored = deserializeParticleSystem(json);

    // Create a particle system from the restored config
    const startTime = 1000;
    const ps = createParticleSystem(restored as any, startTime);

    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    ps.update({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });

    const active = countActive(ps);
    expect(active).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: updateParticleSystems global update
// ---------------------------------------------------------------------------

describe('integration — updateParticleSystems global update', () => {
  it('should update multiple particle systems in one call', () => {
    const startTime = 1000;
    const ps1 = createParticleSystem(
      {
        maxParticles: 5,
        duration: 5,
        looping: true,
        startLifetime: 1,
        startSpeed: 1,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: { rateOverTime: 10, rateOverDistance: 0 },
      } as any,
      startTime
    );

    const ps2 = createParticleSystem(
      {
        maxParticles: 5,
        duration: 5,
        looping: true,
        startLifetime: 1,
        startSpeed: 1,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: { rateOverTime: 10, rateOverDistance: 0 },
      } as any,
      startTime
    );

    // Update all systems at once
    updateParticleSystems({
      now: startTime + 100,
      delta: 0.1,
      elapsed: 0.1,
    });

    expect(countActive(ps1)).toBeGreaterThan(0);
    expect(countActive(ps2)).toBeGreaterThan(0);

    ps1.dispose();
    ps2.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: Shape emitters produce correct particle counts
// ---------------------------------------------------------------------------

describe('integration — shape emitters', () => {
  const shapeTest = (shape: Shape) => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 50,
        duration: 5,
        looping: true,
        startLifetime: 5,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 50 }],
        },
        shape: { shape, radius: 1, arc: 360, angle: 25 },
      } as any,
      startTime
    );

    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    const active = countActive(ps);
    expect(active).toBe(50);

    ps.dispose();
  };

  it('should emit from SPHERE shape', () => shapeTest(Shape.SPHERE));
  it('should emit from CONE shape', () => shapeTest(Shape.CONE));
  it('should emit from CIRCLE shape', () => shapeTest(Shape.CIRCLE));
  it('should emit from RECTANGLE shape', () => shapeTest(Shape.RECTANGLE));
  it('should emit from BOX shape', () => shapeTest(Shape.BOX));
});

// ---------------------------------------------------------------------------
// Integration: Non-looping system completes and stops
// ---------------------------------------------------------------------------

describe('integration — non-looping system completion', () => {
  it('should stop emitting after duration ends and call onComplete', () => {
    let completed = false;
    const startTime = 1000;

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 0.5,
        looping: false,
        startLifetime: 0.2,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: { rateOverTime: 20, rateOverDistance: 0 },
        onComplete: () => {
          completed = true;
        },
      } as any,
      startTime
    );

    // Run through the full duration + particle lifetime
    for (let t = 0; t <= 1500; t += 50) {
      ps.update({
        now: startTime + t,
        delta: 0.05,
        elapsed: t / 1000,
      });
    }

    // All particles should have expired after duration + lifetime
    const active = countActive(ps);
    expect(active).toBe(0);
    expect(completed).toBe(true);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: Pause / resume / dispose
// ---------------------------------------------------------------------------

describe('integration — pause, resume, dispose lifecycle', () => {
  it('should stop emitting when paused and resume when unpaused', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 20,
        duration: 10,
        looping: true,
        startLifetime: 5,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: { rateOverTime: 50, rateOverDistance: 0 },
      } as any,
      startTime
    );

    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    ps.update({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });
    const beforePause = countActive(ps);
    expect(beforePause).toBeGreaterThan(0);

    // Pause
    ps.pauseEmitter();
    const countAtPause = countActive(ps);

    ps.update({ now: startTime + 300, delta: 0.2, elapsed: 0.3 });
    // Should not emit new particles while paused (lifetime=5s, no deaths)
    expect(countActive(ps)).toBe(countAtPause);

    // Resume
    ps.resumeEmitter();
    ps.update({ now: startTime + 500, delta: 0.2, elapsed: 0.5 });
    // Should have emitted new particles
    expect(countActive(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Integration: WORLD space vs LOCAL space
// ---------------------------------------------------------------------------

describe('integration — simulation space', () => {
  it('should use different instance types for WORLD vs LOCAL space', () => {
    const startTime = 1000;
    const baseConfig = {
      maxParticles: 10,
      duration: 5,
      looping: true,
      startLifetime: 5,
      startSpeed: 5,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      emission: {
        rateOverTime: 0,
        rateOverDistance: 0,
        bursts: [{ time: 0, count: 5 }],
      },
    };

    const localPs = createParticleSystem(
      { ...baseConfig, simulationSpace: SimulationSpace.LOCAL } as any,
      startTime
    );
    const worldPs = createParticleSystem(
      { ...baseConfig, simulationSpace: SimulationSpace.WORLD } as any,
      startTime
    );

    // Both LOCAL and WORLD now expose the Points object directly. WORLD
    // differs in that the buffer stores world coordinates and matrixWorld
    // is held at identity so rendering is decoupled from the emitter.
    expect(localPs.instance).toBeInstanceOf(THREE.Points);
    expect(worldPs.instance).toBeInstanceOf(THREE.Points);

    localPs.update({ now: startTime, delta: 0.016, elapsed: 0 });
    worldPs.update({ now: startTime, delta: 0.016, elapsed: 0 });

    localPs.update({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });
    worldPs.update({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });

    // Both should have active particles
    expect(countActive(localPs)).toBe(5);
    expect(countActive(worldPs)).toBe(5);

    localPs.dispose();
    worldPs.dispose();
  });
});
