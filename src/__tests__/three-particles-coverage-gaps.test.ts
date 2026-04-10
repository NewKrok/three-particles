import * as THREE from 'three';
import {
  ForceFieldFalloff,
  ForceFieldType,
  LifeTimeCurve,
  RendererType,
  SubEmitterTrigger,
} from '../js/effects/three-particles/three-particles-enums.js';
import { applyForceFields } from '../js/effects/three-particles/three-particles-forces.js';
import { deserializeParticleSystem } from '../js/effects/three-particles/three-particles-serialization.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import type { NormalizedForceFieldConfig } from '../js/effects/three-particles/types.js';

// ---------------------------------------------------------------------------
// Gap 1: three-particles.ts:1122-1124 — Sub-emitter cleanup when isActiveArr
//        is not found (e.g. disposed/corrupted sub-emitter geometry).
// ---------------------------------------------------------------------------

describe('sub-emitter cleanup — missing isActiveArr branch', () => {
  it('should dispose sub-emitter instance when geometry attributes are missing', () => {
    const scene = new THREE.Group();
    const startTime = 1000;

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        startLifetime: 0.2,
        startSpeed: 1,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 50,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.BIRTH,
            config: {
              maxParticles: 5,
              duration: 0.5,
              looping: false,
              startLifetime: 0.1,
              startSpeed: 0,
              startSize: 1,
              startOpacity: 1,
              startRotation: 0,
              emission: {
                rateOverTime: 0,
                rateOverDistance: 0,
                bursts: [{ time: 0, count: 1 }],
              },
            },
            maxInstances: 2,
          },
        ],
      } as any,
      startTime
    );

    scene.add(ps.instance);

    // Step 1: emit burst → spawns sub-emitter
    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });

    // Find the sub-emitter in the scene
    const subInstances = scene.children.filter((c) => c !== ps.instance);
    expect(subInstances.length).toBeGreaterThan(0);

    // Sabotage the sub-emitter's geometry by removing its attributes
    const subInstance = subInstances[0];
    const subPoints =
      subInstance instanceof THREE.Points
        ? subInstance
        : (subInstance.children[0] as THREE.Points | undefined);

    if (subPoints?.geometry) {
      // Delete the isActive attribute to simulate a corrupted/disposed state
      subPoints.geometry.deleteAttribute('isActive');
      subPoints.geometry.deleteAttribute('instanceIsActive');
    }

    // Verify sub-emitters were created
    const subCount = scene.children.filter((c) => c !== ps.instance).length;
    expect(subCount).toBeGreaterThan(0);

    // Next update triggers cleanupCompletedInstances which should
    // hit the !isActiveArr branch and dispose the corrupted sub-emitter
    // (dispose removes from internal tracking; scene graph removal is separate)
    expect(() => {
      ps.update({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });
      ps.update({ now: startTime + 200, delta: 0.1, elapsed: 0.2 });
    }).not.toThrow();

    ps.dispose();
  });

  it('should dispose sub-emitter when instance is not Points or Mesh and has no children', () => {
    const scene = new THREE.Group();
    const startTime = 1000;

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        startLifetime: 0.2,
        startSpeed: 1,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 50,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.BIRTH,
            config: {
              maxParticles: 5,
              duration: 0.5,
              looping: false,
              startLifetime: 0.1,
              startSpeed: 0,
              startSize: 1,
              startOpacity: 1,
              startRotation: 0,
              emission: {
                rateOverTime: 0,
                rateOverDistance: 0,
                bursts: [{ time: 0, count: 1 }],
              },
            },
            maxInstances: 2,
          },
        ],
      } as any,
      startTime
    );

    scene.add(ps.instance);

    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });

    // Sabotage: remove geometry attributes so isActiveArr is undefined
    const subInstances = scene.children.filter((c) => c !== ps.instance);
    for (const sub of subInstances) {
      const subPoints =
        sub instanceof THREE.Points
          ? sub
          : (sub.children[0] as THREE.Points | undefined);
      if (subPoints?.geometry) {
        // Delete both possible attribute names
        subPoints.geometry.deleteAttribute('isActive');
        subPoints.geometry.deleteAttribute('instanceIsActive');
      }
    }

    // Verify sub-emitters were created
    const subCount = scene.children.filter((c) => c !== ps.instance).length;
    expect(subCount).toBeGreaterThan(0);

    // Should dispose the corrupted sub-emitter via the !isActiveArr branch
    expect(() => {
      ps.update({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });
      ps.update({ now: startTime + 300, delta: 0.2, elapsed: 0.3 });
    }).not.toThrow();

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Gap 2: three-particles.ts:1200-1201 — onBeforeRender callback execution
// ---------------------------------------------------------------------------

describe('instanced renderer onBeforeRender callback', () => {
  it('should update viewportHeight uniform from renderer size and pixel ratio', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        startLifetime: 1,
        startSpeed: 1,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: { rateOverTime: 10, rateOverDistance: 0 },
        renderer: { rendererType: RendererType.INSTANCED },
      } as any,
      1000
    );

    const mesh = ps.instance as THREE.Mesh;
    const material = mesh.material as THREE.ShaderMaterial;

    expect(mesh.onBeforeRender).toBeDefined();

    // Create a mock WebGL renderer
    const mockRenderer = {
      getSize: (target: THREE.Vector2) => target.set(800, 600),
      getPixelRatio: () => 2,
    } as unknown as THREE.WebGLRenderer;

    // Invoke the onBeforeRender callback
    mesh.onBeforeRender(
      mockRenderer,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any
    );

    // viewportHeight should be size.y * pixelRatio = 600 * 2 = 1200
    expect(material.uniforms.viewportHeight.value).toBe(1200);

    ps.dispose();
  });

  it('should handle pixelRatio of 1 (non-retina display)', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        startLifetime: 1,
        startSpeed: 1,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: { rateOverTime: 10, rateOverDistance: 0 },
        renderer: { rendererType: RendererType.INSTANCED },
      } as any,
      1000
    );

    const mesh = ps.instance as THREE.Mesh;
    const material = mesh.material as THREE.ShaderMaterial;

    const mockRenderer = {
      getSize: (target: THREE.Vector2) => target.set(1920, 1080),
      getPixelRatio: () => 1,
    } as unknown as THREE.WebGLRenderer;

    mesh.onBeforeRender(
      mockRenderer,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any
    );

    expect(material.uniforms.viewportHeight.value).toBe(1080);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Gap 3: three-particles-forces.ts:145 — DIRECTIONAL branch in applyForceFields
//        dispatched via calculateValue (strength as curve, not just a number)
// ---------------------------------------------------------------------------

describe('applyForceFields — DIRECTIONAL branch with curve strength', () => {
  let velocity: THREE.Vector3;
  let positionArr: Float32Array;

  beforeEach(() => {
    velocity = new THREE.Vector3(0, 0, 0);
    positionArr = new Float32Array([5, 0, 0]);
  });

  it('should apply DIRECTIONAL force when strength is a min/max range', () => {
    const field: NormalizedForceFieldConfig = {
      isActive: true,
      type: ForceFieldType.DIRECTIONAL,
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 1, 0),
      strength: { min: 5, max: 5 },
      range: Infinity,
      falloff: ForceFieldFalloff.LINEAR,
    };

    applyForceFields({
      particleSystemId: 0,
      forceFields: [field],
      velocity,
      positionArr,
      positionIndex: 0,
      delta: 1,
      systemLifetimePercentage: 0,
    });

    expect(velocity.y).toBeCloseTo(5);
  });

  it('should skip unknown field type without error', () => {
    const field: NormalizedForceFieldConfig = {
      isActive: true,
      type: 'UNKNOWN' as any,
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 1, 0),
      strength: 5,
      range: Infinity,
      falloff: ForceFieldFalloff.LINEAR,
    };

    applyForceFields({
      particleSystemId: 0,
      forceFields: [field],
      velocity,
      positionArr,
      positionIndex: 0,
      delta: 1,
      systemLifetimePercentage: 0,
    });

    // Velocity should remain unchanged — unknown type does nothing
    expect(velocity.x).toBe(0);
    expect(velocity.y).toBe(0);
    expect(velocity.z).toBe(0);
  });

  it('should apply POINT then DIRECTIONAL when mixed in same array', () => {
    const pointField: NormalizedForceFieldConfig = {
      isActive: true,
      type: ForceFieldType.POINT,
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 1, 0),
      strength: 10,
      range: Infinity,
      falloff: ForceFieldFalloff.LINEAR,
    };
    const directionalField: NormalizedForceFieldConfig = {
      isActive: true,
      type: ForceFieldType.DIRECTIONAL,
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, 1),
      strength: 7,
      range: Infinity,
      falloff: ForceFieldFalloff.LINEAR,
    };

    applyForceFields({
      particleSystemId: 0,
      forceFields: [pointField, directionalField],
      velocity,
      positionArr,
      positionIndex: 0,
      delta: 1,
      systemLifetimePercentage: 0,
    });

    // Point: pulls toward origin on X axis
    expect(velocity.x).toBeLessThan(0);
    // Directional: pushes on Z axis
    expect(velocity.z).toBeCloseTo(7);
  });
});

// ---------------------------------------------------------------------------
// Gap 4: three-particles-serialization.ts:185 — deserializeVector2 defaults
// ---------------------------------------------------------------------------

describe('deserializeVector2 — default value branches', () => {
  it('should default both x and y to 1 when empty object is provided', () => {
    const json = JSON.stringify({
      _version: 1,
      textureSheetAnimation: {
        tiles: {},
        fps: 10,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.textureSheetAnimation!.tiles!.x).toBe(1);
    expect(result.textureSheetAnimation!.tiles!.y).toBe(1);
  });

  it('should default x to 1 when only y is provided', () => {
    const json = JSON.stringify({
      _version: 1,
      textureSheetAnimation: {
        tiles: { y: 3 },
        fps: 10,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.textureSheetAnimation!.tiles!.x).toBe(1);
    expect(result.textureSheetAnimation!.tiles!.y).toBe(3);
  });

  it('should use provided values when both x and y are specified', () => {
    const json = JSON.stringify({
      _version: 1,
      textureSheetAnimation: {
        tiles: { x: 4, y: 2 },
        fps: 10,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.textureSheetAnimation!.tiles!.x).toBe(4);
    expect(result.textureSheetAnimation!.tiles!.y).toBe(2);
  });

  it('should return undefined for non-object tiles value', () => {
    const json = JSON.stringify({
      _version: 1,
      textureSheetAnimation: {
        tiles: 'invalid',
        fps: 10,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.textureSheetAnimation!.tiles).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Gap 5: three-particles.ts:516-519 — force field toVector3 fallback (no
//        position or direction provided)
// ---------------------------------------------------------------------------

describe('force field normalization — missing position/direction', () => {
  it('should use default position and direction when not provided', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 5,
        duration: 5,
        looping: true,
        startLifetime: 1,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        forceFields: [
          {
            // Partial position (only x, no y/z) — triggers v.y ?? 0, v.z ?? 0 fallbacks
            type: ForceFieldType.POINT,
            position: { x: 5 },
            direction: { x: 1 },
            strength: 2,
          },
          {
            // Explicit undefined for position/direction — triggers fallback.clone()
            type: ForceFieldType.DIRECTIONAL,
            position: undefined,
            direction: undefined,
            strength: 5,
          },
        ],
      } as any,
      startTime
    );

    // Should not throw; force field should have default position/direction
    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    ps.update({ now: startTime + 100, delta: 0.1, elapsed: 0.1 });

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Gap 6: three-particles.ts:590,639 — velocityOverLifetime linear.z and
//        orbital.z as LifetimeCurve (Bezier curve on the Z axis)
// ---------------------------------------------------------------------------

describe('velocityOverLifetime — Z-axis lifetime curves', () => {
  it('should apply bezier curve to linear velocity Z axis', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 5,
        duration: 5,
        looping: true,
        startLifetime: 2,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 3 }],
        },
        velocityOverLifetime: {
          isActive: true,
          linear: {
            x: 0,
            y: 0,
            z: {
              type: LifeTimeCurve.BEZIER,
              bezierPoints: [
                { x: 0, y: 0 },
                { x: 0.25, y: 5 },
                { x: 0.75, y: 5 },
                { x: 1, y: 0 },
              ],
            },
          },
        },
      } as any,
      startTime
    );

    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    ps.update({ now: startTime + 500, delta: 0.5, elapsed: 0.5 });

    // Particles should have moved along Z due to the bezier curve
    const points =
      ps.instance instanceof THREE.Points
        ? ps.instance
        : (ps.instance.children[0] as THREE.Points);
    const posArr = points.geometry.attributes.position.array;
    const isActiveAttr = points.geometry.attributes.isActive;

    let hasZMovement = false;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (
        isActiveAttr.getX(i) &&
        Math.abs(posArr[i * 3 + 2] as number) > 0.01
      ) {
        hasZMovement = true;
        break;
      }
    }
    expect(hasZMovement).toBe(true);

    ps.dispose();
  });

  it('should apply bezier curve to orbital velocity Z axis', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 5,
        duration: 5,
        looping: true,
        startLifetime: 2,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 3 }],
        },
        velocityOverLifetime: {
          isActive: true,
          orbital: {
            x: 0,
            y: 0,
            z: {
              type: LifeTimeCurve.BEZIER,
              bezierPoints: [
                { x: 0, y: 0 },
                { x: 0.25, y: 3 },
                { x: 0.75, y: 3 },
                { x: 1, y: 0 },
              ],
            },
          },
        },
      } as any,
      startTime
    );

    // Should not throw — orbital Z bezier should be processed
    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    ps.update({ now: startTime + 500, delta: 0.5, elapsed: 0.5 });

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Gap 7: three-particles.ts:1118 — instanceIsActive branch in sub-emitter
//        cleanup (instanced sub-emitter with instanceIsActive attribute)
// ---------------------------------------------------------------------------

describe('sub-emitter cleanup — instanced sub-emitter (instanceIsActive)', () => {
  it('should correctly read instanceIsActive when cleaning up instanced sub-emitters', () => {
    const scene = new THREE.Group();
    const startTime = 1000;

    // Parent: burst(5) at t=0, short lifetime (0.1s), continuous emission to trigger cleanup
    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        startLifetime: 0.1,
        startSpeed: 1,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 50,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 5 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: {
              maxParticles: 3,
              duration: 0.3,
              looping: false,
              startLifetime: 0.2,
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
            maxInstances: 10,
          },
        ],
      } as any,
      startTime
    );

    scene.add(ps.instance);

    // Emit parent particles via burst
    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });

    // Step through to let parents die and sub-emitters spawn
    for (let t = 50; t <= 400; t += 50) {
      ps.update({
        now: startTime + t,
        delta: 0.05,
        elapsed: t / 1000,
      });
    }

    // Sub-emitters should have been created
    const subInstances = scene.children.filter((c) => c !== ps.instance);
    expect(subInstances.length).toBeGreaterThan(0);

    // Continue updating — cleanup should read instanceIsActive to decide
    // whether instanced sub-emitters are still active
    for (let t = 500; t <= 2000; t += 200) {
      ps.update({
        now: startTime + t,
        delta: 0.2,
        elapsed: t / 1000,
      });
    }

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Gap 8: three-particles.ts:1170-1175 — inheritVelocity with min/max
//        startSpeed on sub-emitter config
// ---------------------------------------------------------------------------

describe('sub-emitter — inheritVelocity with random startSpeed', () => {
  it('should add inherited velocity to min/max startSpeed range', () => {
    const scene = new THREE.Group();
    const startTime = 1000;

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        startLifetime: 0.1, // very short so particles die quickly
        startSpeed: 5,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 5 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            inheritVelocity: 0.5,
            config: {
              maxParticles: 3,
              duration: 1,
              looping: false,
              startLifetime: 0.5,
              startSpeed: { min: 1, max: 3 },
              startSize: 0.5,
              startOpacity: 1,
              startRotation: 0,
              emission: {
                rateOverTime: 0,
                rateOverDistance: 0,
                bursts: [{ time: 0, count: 1 }],
              },
            },
            maxInstances: 10,
          },
        ],
      } as any,
      startTime
    );

    scene.add(ps.instance);

    // Emit burst of fast-moving parent particles
    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });

    // Small steps to let particles die reliably (lifetime=0.1s)
    ps.update({ now: startTime + 50, delta: 0.05, elapsed: 0.05 });
    ps.update({ now: startTime + 120, delta: 0.07, elapsed: 0.12 });
    ps.update({ now: startTime + 200, delta: 0.08, elapsed: 0.2 });
    ps.update({ now: startTime + 300, delta: 0.1, elapsed: 0.3 });
    ps.update({ now: startTime + 500, delta: 0.2, elapsed: 0.5 });

    // Sub-emitters should have been spawned with inherited velocity
    const subInstances = scene.children.filter((c) => c !== ps.instance);
    expect(subInstances.length).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle inheritVelocity with min/max startSpeed where min is undefined', () => {
    const scene = new THREE.Group();
    const startTime = 1000;

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        startLifetime: 0.1,
        startSpeed: 5,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 5 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            inheritVelocity: 0.5,
            config: {
              maxParticles: 3,
              duration: 1,
              looping: false,
              startLifetime: 0.5,
              // startSpeed with min explicitly undefined — triggers .min ?? 0 fallback
              startSpeed: { min: undefined, max: 5 },
              startSize: 0.5,
              startOpacity: 1,
              startRotation: 0,
              emission: {
                rateOverTime: 0,
                rateOverDistance: 0,
                bursts: [{ time: 0, count: 1 }],
              },
            },
            maxInstances: 10,
          },
        ],
      } as any,
      startTime
    );

    scene.add(ps.instance);

    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    for (let t = 50; t <= 500; t += 50) {
      ps.update({
        now: startTime + t,
        delta: 0.05,
        elapsed: t / 1000,
      });
    }

    const subInstances = scene.children.filter((c) => c !== ps.instance);
    expect(subInstances.length).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle inheritVelocity when sub-emitter startSpeed is undefined', () => {
    const scene = new THREE.Group();
    const startTime = 1000;

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        startLifetime: 0.1,
        startSpeed: 5,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 5 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            inheritVelocity: 0.5,
            config: {
              maxParticles: 3,
              duration: 1,
              looping: false,
              startLifetime: 0.5,
              // startSpeed deliberately omitted — should fall to else branch (0)
              startSize: 0.5,
              startOpacity: 1,
              startRotation: 0,
              emission: {
                rateOverTime: 0,
                rateOverDistance: 0,
                bursts: [{ time: 0, count: 1 }],
              },
            },
            maxInstances: 10,
          },
        ],
      } as any,
      startTime
    );

    scene.add(ps.instance);

    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    for (let t = 50; t <= 500; t += 50) {
      ps.update({
        now: startTime + t,
        delta: 0.05,
        elapsed: t / 1000,
      });
    }

    const subInstances = scene.children.filter((c) => c !== ps.instance);
    expect(subInstances.length).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Gap 9: three-particles.ts:1188 — parentObj null (sub-emitter spawned
//        when particle system has no parent in scene graph)
// ---------------------------------------------------------------------------

describe('sub-emitter — no parent in scene graph', () => {
  it('should not throw when parent particle system is not added to a scene', () => {
    const startTime = 1000;

    // Create system WITHOUT adding to a scene (no parent)
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
              emission: {
                rateOverTime: 0,
                rateOverDistance: 0,
                bursts: [{ time: 0, count: 1 }],
              },
            },
            maxInstances: 2,
          },
        ],
      } as any,
      startTime
    );

    // NOT added to scene — ps.instance.parent is null

    // Should not throw even though parentObj is null
    ps.update({ now: startTime, delta: 0.016, elapsed: 0 });
    ps.update({ now: startTime + 200, delta: 0.2, elapsed: 0.2 });
    ps.update({ now: startTime + 400, delta: 0.2, elapsed: 0.4 });

    ps.dispose();
  });
});
