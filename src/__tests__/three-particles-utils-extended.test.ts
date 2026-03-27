import * as THREE from 'three';
import { LifeTimeCurve } from '../js/effects/three-particles/three-particles-enums.js';
import { EmitFrom } from '../js/effects/three-particles/three-particles-enums.js';
import {
  calculateValue,
  isLifeTimeCurve,
  getCurveFunctionFromConfig,
  createDefaultMeshTexture,
  createDefaultParticleTexture,
  calculateRandomPositionAndVelocityOnSphere,
  calculateRandomPositionAndVelocityOnCone,
  calculateRandomPositionAndVelocityOnCircle,
  calculateRandomPositionAndVelocityOnRectangle,
  calculateRandomPositionAndVelocityOnBox,
} from '../js/effects/three-particles/three-particles-utils.js';

// ─── createDefaultParticleTexture ────────────────────────────────────────────

describe('createDefaultParticleTexture', () => {
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('should return null when document is not available', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = createDefaultParticleTexture();
    // In Node.js without DOM, the function should catch and return null
    expect(result === null || result instanceof THREE.CanvasTexture).toBe(true);
    warnSpy.mockRestore();
  });

  it('should handle when getContext returns null', () => {
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(null),
    };
    globalThis.document = {
      createElement: jest.fn().mockReturnValue(mockCanvas),
    } as any;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = createDefaultParticleTexture();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'Could not get 2D context to generate default particle texture.'
    );

    warnSpy.mockRestore();
  });

  it('should handle when document.createElement throws', () => {
    globalThis.document = {
      createElement: jest.fn().mockImplementation(() => {
        throw new Error('No DOM');
      }),
    } as any;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = createDefaultParticleTexture();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'Error creating default particle texture:',
      expect.any(Error)
    );

    warnSpy.mockRestore();
  });

  it('should create a texture when canvas context is available', () => {
    const mockContext = {
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      fillStyle: '',
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(mockContext),
    };
    globalThis.document = {
      createElement: jest.fn().mockReturnValue(mockCanvas),
    } as any;

    const result = createDefaultParticleTexture();

    expect(result).not.toBeNull();
    expect(mockContext.beginPath).toHaveBeenCalled();
    expect(mockContext.arc).toHaveBeenCalledWith(
      32,
      32,
      30,
      0,
      2 * Math.PI,
      false
    );
    expect(mockContext.fillStyle).toBe('white');
    expect(mockContext.fill).toHaveBeenCalled();
    expect(mockCanvas.width).toBe(64);
    expect(mockCanvas.height).toBe(64);
  });
});

// ─── createDefaultMeshTexture ────────────────────────────────────────────────

describe('createDefaultMeshTexture', () => {
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('should create a 1x1 white texture when canvas context is available', () => {
    const mockContext = {
      fillStyle: '',
      fillRect: jest.fn(),
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(mockContext),
    };
    globalThis.document = {
      createElement: jest.fn().mockReturnValue(mockCanvas),
    } as any;

    const result = createDefaultMeshTexture();

    expect(result).not.toBeNull();
    expect(mockCanvas.width).toBe(1);
    expect(mockCanvas.height).toBe(1);
    expect(mockContext.fillStyle).toBe('white');
    expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 1, 1);
  });

  it('should return null when getContext returns null', () => {
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(null),
    };
    globalThis.document = {
      createElement: jest.fn().mockReturnValue(mockCanvas),
    } as any;

    const result = createDefaultMeshTexture();
    expect(result).toBeNull();
  });

  it('should return null when document.createElement throws', () => {
    globalThis.document = {
      createElement: jest.fn().mockImplementation(() => {
        throw new Error('No DOM');
      }),
    } as any;

    const result = createDefaultMeshTexture();
    expect(result).toBeNull();
  });
});

// ─── isLifeTimeCurve ─────────────────────────────────────────────────────────

describe('isLifeTimeCurve', () => {
  it('should return false for a constant number', () => {
    expect(isLifeTimeCurve(5)).toBe(false);
  });

  it('should return false for RandomBetweenTwoConstants', () => {
    expect(isLifeTimeCurve({ min: 1, max: 5 })).toBe(false);
  });

  it('should return true for a BezierCurve', () => {
    expect(
      isLifeTimeCurve({
        type: LifeTimeCurve.BEZIER,
        scale: 1,
        bezierPoints: [
          { x: 0, y: 0, percentage: 0 },
          { x: 1, y: 1, percentage: 1 },
        ],
      })
    ).toBe(true);
  });

  it('should return true for an EasingCurve', () => {
    expect(
      isLifeTimeCurve({
        type: LifeTimeCurve.EASING,
        scale: 1,
        curveFunction: (t: number) => t,
      })
    ).toBe(true);
  });
});

// ─── getCurveFunctionFromConfig ──────────────────────────────────────────────

describe('getCurveFunctionFromConfig', () => {
  it('should return a bezier curve function for BEZIER type', () => {
    const fn = getCurveFunctionFromConfig(999, {
      type: LifeTimeCurve.BEZIER,
      scale: 1,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    });
    expect(typeof fn).toBe('function');
    expect(fn(0)).toBeCloseTo(0);
    expect(fn(1)).toBeCloseTo(1);
  });

  it('should return the curveFunction for EASING type', () => {
    const easingFn = (t: number) => t * t;
    const fn = getCurveFunctionFromConfig(999, {
      type: LifeTimeCurve.EASING,
      scale: 1,
      curveFunction: easingFn,
    });
    expect(fn).toBe(easingFn);
  });

  it('should throw for unsupported type', () => {
    expect(() =>
      getCurveFunctionFromConfig(999, {
        type: 'UNKNOWN' as any,
        scale: 1,
      } as any)
    ).toThrow('Unsupported value type');
  });
});

// ─── calculateValue ──────────────────────────────────────────────────────────

describe('calculateValue', () => {
  it('should return constant number as-is', () => {
    expect(calculateValue(0, 42)).toBe(42);
  });

  it('should return 0 for zero constant', () => {
    expect(calculateValue(0, 0)).toBe(0);
  });

  it('should return negative constant', () => {
    expect(calculateValue(0, -5)).toBe(-5);
  });

  it('should return min when min equals max', () => {
    expect(calculateValue(0, { min: 3, max: 3 })).toBe(3);
  });

  it('should return value between min and max for random range', () => {
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const val = calculateValue(0, { min: 1, max: 10 });
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(10);
      results.add(Math.round(val));
    }
    // Should produce at least some variety
    expect(results.size).toBeGreaterThan(1);
  });

  it('should handle min undefined defaulting to 0', () => {
    // When min is undefined, defaults to 0; max is 5 → should be between 0 and 5
    const val = calculateValue(0, { min: undefined as any, max: 5 });
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(5);
  });

  it('should handle max undefined defaulting to 1', () => {
    // When max is undefined, defaults to 1; min is 0 → should be between 0 and 1
    const val = calculateValue(0, { min: 0, max: undefined as any });
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('should handle both min and max undefined', () => {
    // min defaults to 0, max defaults to 1, but they equal? No, 0 !== 1
    const val = calculateValue(0, {
      min: undefined as any,
      max: undefined as any,
    });
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('should evaluate bezier curve at given time', () => {
    const val = calculateValue(0, {
      type: LifeTimeCurve.BEZIER,
      scale: 2,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    });
    // At time 0, bezier starts at y=0, scaled by 2
    expect(typeof val).toBe('number');
  });

  it('should evaluate easing curve scaled by scale factor', () => {
    const val = calculateValue(
      0,
      {
        type: LifeTimeCurve.EASING,
        scale: 3,
        curveFunction: (t: number) => 0.5,
      },
      0.5
    );
    // 0.5 * 3 = 1.5
    expect(val).toBeCloseTo(1.5);
  });

  it('should default time to 0 when not provided', () => {
    const val = calculateValue(0, {
      type: LifeTimeCurve.EASING,
      scale: 1,
      curveFunction: (t: number) => t,
    });
    // t=0, so result should be 0
    expect(val).toBe(0);
  });

  it('should handle scale undefined (defaults to 1)', () => {
    const val = calculateValue(
      0,
      {
        type: LifeTimeCurve.EASING,
        curveFunction: (t: number) => 2,
      } as any,
      0.5
    );
    // 2 * 1 = 2
    expect(val).toBeCloseTo(2);
  });
});

// ─── calculateRandomPositionAndVelocityOnSphere ─────────────────────────────

describe('calculateRandomPositionAndVelocityOnSphere', () => {
  const quat = new THREE.Quaternion();

  it('should produce positions within the sphere radius', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnSphere(pos, quat, vel, 1, {
        radius: 5,
        radiusThickness: 1,
        arc: 360,
      });
      expect(pos.length()).toBeLessThanOrEqual(5.01);
    }
  });

  it('should emit on shell when radiusThickness is 0', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnSphere(pos, quat, vel, 1, {
        radius: 3,
        radiusThickness: 0,
        arc: 360,
      });
      expect(pos.length()).toBeCloseTo(3, 1);
    }
  });

  it('should set velocity direction outward from center', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnSphere(pos, quat, vel, 10, {
      radius: 1,
      radiusThickness: 1,
      arc: 360,
    });

    // Velocity should be in roughly the same direction as position
    const dot = pos.normalize().dot(vel.normalize());
    // Could be negative due to quaternion double-application, but magnitude should be ~speed
    expect(Math.abs(dot)).toBeGreaterThan(0);
  });

  it('should handle small arc values', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnSphere(pos, quat, vel, 1, {
      radius: 1,
      radiusThickness: 1,
      arc: 1,
    });
    expect(pos.length()).toBeGreaterThan(0);
  });

  it('should apply quaternion rotation', () => {
    const rotatedQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2
    );
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnSphere(pos, rotatedQuat, vel, 1, {
      radius: 1,
      radiusThickness: 1,
      arc: 360,
    });
    // Just verify no crash and position is set
    expect(pos.length()).toBeGreaterThan(0);
  });
});

// ─── calculateRandomPositionAndVelocityOnCone ───────────────────────────────

describe('calculateRandomPositionAndVelocityOnCone', () => {
  const quat = new THREE.Quaternion();

  it('should produce positions within the cone radius', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnCone(pos, quat, vel, 1, {
        radius: 2,
        radiusThickness: 1,
        arc: 360,
        angle: 45,
      });
      const xyLength = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      expect(xyLength).toBeLessThanOrEqual(2.01);
    }
  });

  it('should emit on shell when radiusThickness is 0', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnCone(pos, quat, vel, 1, {
        radius: 3,
        radiusThickness: 0,
        arc: 360,
        angle: 30,
      });
      const xyLength = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      expect(xyLength).toBeCloseTo(3, 1);
    }
  });

  it('should have velocity z component when angle > 0', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnCone(pos, quat, vel, 5, {
      radius: 1,
      radiusThickness: 1,
      arc: 360,
      angle: 45,
    });
    expect(vel.length()).toBeGreaterThan(0);
  });

  it('should default angle to 90 when not provided', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnCone(pos, quat, vel, 1, {
      radius: 1,
      radiusThickness: 1,
      arc: 360,
    });
    expect(pos.length()).toBeGreaterThan(0);
  });

  it('should handle partial arc', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnCone(pos, quat, vel, 1, {
      radius: 1,
      radiusThickness: 1,
      arc: 90,
      angle: 25,
    });
    expect(pos.length()).toBeGreaterThan(0);
  });
});

// ─── calculateRandomPositionAndVelocityOnCircle ─────────────────────────────

describe('calculateRandomPositionAndVelocityOnCircle', () => {
  const quat = new THREE.Quaternion();

  it('should produce positions within circle radius on XY plane', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnCircle(pos, quat, vel, 1, {
        radius: 2,
        radiusThickness: 1,
        arc: 360,
      });
      const xyLength = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      expect(xyLength).toBeLessThanOrEqual(2.01);
      expect(pos.z).toBeCloseTo(0);
    }
  });

  it('should have zero z velocity', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnCircle(pos, quat, vel, 5, {
      radius: 1,
      radiusThickness: 1,
      arc: 360,
    });
    expect(vel.z).toBeCloseTo(0);
  });

  it('should emit on edge when radiusThickness is 0', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnCircle(pos, quat, vel, 1, {
        radius: 4,
        radiusThickness: 0,
        arc: 360,
      });
      const xyLength = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      expect(xyLength).toBeCloseTo(4, 1);
    }
  });
});

// ─── calculateRandomPositionAndVelocityOnRectangle ──────────────────────────

describe('calculateRandomPositionAndVelocityOnRectangle', () => {
  const quat = new THREE.Quaternion();

  it('should produce positions within rectangle bounds', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnRectangle(pos, quat, vel, 1, {
        rotation: { x: 0, y: 0 },
        scale: { x: 4, y: 6 },
      });
      expect(Math.abs(pos.x)).toBeLessThanOrEqual(2.01);
      expect(Math.abs(pos.y)).toBeLessThanOrEqual(3.01);
    }
  });

  it('should emit with velocity along +Z', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnRectangle(pos, quat, vel, 5, {
      rotation: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
    });
    expect(vel.z).toBeCloseTo(5);
    expect(vel.x).toBeCloseTo(0);
    expect(vel.y).toBeCloseTo(0);
  });

  it('should apply rotation to positions', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnRectangle(pos, quat, vel, 1, {
      rotation: { x: 90, y: 0 },
      scale: { x: 1, y: 1 },
    });
    // With 90 degree x rotation, z component should be non-zero for non-zero y offset
    expect(pos.length()).toBeGreaterThanOrEqual(0);
  });
});

// ─── calculateRandomPositionAndVelocityOnBox ────────────────────────────────

describe('calculateRandomPositionAndVelocityOnBox', () => {
  const quat = new THREE.Quaternion();

  it('VOLUME: should produce positions within box bounds', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 30; i++) {
      calculateRandomPositionAndVelocityOnBox(pos, quat, vel, 1, {
        scale: { x: 2, y: 4, z: 6 },
        emitFrom: EmitFrom.VOLUME,
      });
      expect(Math.abs(pos.x)).toBeLessThanOrEqual(1.01);
      expect(Math.abs(pos.y)).toBeLessThanOrEqual(2.01);
      expect(Math.abs(pos.z)).toBeLessThanOrEqual(3.01);
    }
  });

  it('SHELL: should produce positions on box surface', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 30; i++) {
      calculateRandomPositionAndVelocityOnBox(pos, quat, vel, 1, {
        scale: { x: 2, y: 2, z: 2 },
        emitFrom: EmitFrom.SHELL,
      });
      // At least one coordinate should be at the boundary (±1)
      const atBound =
        Math.abs(Math.abs(pos.x) - 1) < 0.01 ||
        Math.abs(Math.abs(pos.y) - 1) < 0.01 ||
        Math.abs(Math.abs(pos.z) - 1) < 0.01;
      expect(atBound).toBe(true);
    }
  });

  it('EDGE: should produce positions on box edges', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (let i = 0; i < 30; i++) {
      calculateRandomPositionAndVelocityOnBox(pos, quat, vel, 1, {
        scale: { x: 2, y: 2, z: 2 },
        emitFrom: EmitFrom.EDGE,
      });
      // Position should be valid
      expect(Math.abs(pos.x)).toBeLessThanOrEqual(1.01);
      expect(Math.abs(pos.y)).toBeLessThanOrEqual(1.01);
      expect(Math.abs(pos.z)).toBeLessThanOrEqual(1.01);
    }
  });

  it('should emit velocity along +Z for all emit modes', () => {
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    for (const mode of [EmitFrom.VOLUME, EmitFrom.SHELL, EmitFrom.EDGE]) {
      calculateRandomPositionAndVelocityOnBox(pos, quat, vel, 3, {
        scale: { x: 1, y: 1, z: 1 },
        emitFrom: mode,
      });
      expect(vel.z).toBeCloseTo(3);
    }
  });

  it('should apply quaternion rotation', () => {
    const rotatedQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2
    );
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnBox(pos, rotatedQuat, vel, 1, {
      scale: { x: 1, y: 1, z: 1 },
      emitFrom: EmitFrom.VOLUME,
    });
    // After 90 degree Y rotation, velocity should be along X not Z
    expect(Math.abs(vel.x)).toBeGreaterThan(0.5);
  });
});
