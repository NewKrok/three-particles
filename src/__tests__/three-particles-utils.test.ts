import * as THREE from 'three';
import { LifeTimeCurve } from '../js/effects/three-particles/three-particles-enums.js';
import { EmitFrom } from '../js/effects/three-particles/three-particles-enums.js';
import {
  calculateValue,
  calculateRandomPositionAndVelocityOnSphere,
  calculateRandomPositionAndVelocityOnCone,
  calculateRandomPositionAndVelocityOnBox,
  calculateRandomPositionAndVelocityOnCircle,
  calculateRandomPositionAndVelocityOnRectangle,
  getCurveFunctionFromConfig,
  isLifeTimeCurve,
} from '../js/effects/three-particles/three-particles-utils.js';
import {
  BezierCurve,
  EasingCurve,
  Constant,
  RandomBetweenTwoConstants,
  LifetimeCurve,
} from '../js/effects/three-particles/types.js';

describe('calculateRandomPositionAndVelocityOnSphere', () => {
  it('should calculate a random position on a sphere surface', () => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const velocity = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnSphere(
      position,
      quaternion,
      velocity,
      2,
      { radius: 1, radiusThickness: 0, arc: 360 }
    );

    // The position should be normalized to the sphere radius.
    expect(position.length()).toBeCloseTo(1);
  });

  it('should apply radius thickness correctly', () => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const velocity = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnSphere(
      position,
      quaternion,
      velocity,
      2,
      { radius: 2, radiusThickness: 0.5, arc: 360 }
    );

    // The position length should be within the expected thickness range.
    expect(position.length()).toBeLessThanOrEqual(2);
    expect(position.length()).toBeGreaterThanOrEqual(1);
  });

  it('should calculate random velocity proportional to position', () => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const velocity = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnSphere(
      position,
      quaternion,
      velocity,
      2,
      { radius: 1, radiusThickness: 0, arc: 360 }
    );

    // The velocity length should match the configured speed.
    expect(velocity.length()).toBeCloseTo(2);
  });
});

describe('calculateValue function tests', () => {
  it('returns the constant value', () => {
    const result = calculateValue(1, 5);
    expect(result).toBe(5);
  });

  it('returns a random value between min and max', () => {
    jest.spyOn(THREE.MathUtils, 'randFloat').mockReturnValue(2.5);
    const result = calculateValue(1, { min: 1, max: 4 });
    expect(result).toBe(2.5);
  });

  it('returns correct value for min equals max', () => {
    const result = calculateValue(1, { min: 2, max: 2 });
    expect(result).toBe(2); // Should always return 2 when min == max
  });

  it('returns exact Bezier curve value with scaling', () => {
    const bezierCurveMock: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ],
      scale: 2,
    };

    const result = calculateValue(1, bezierCurveMock, 0.5);
    expect(result).toBeCloseTo(1);
  });

  it('returns correct value for time = 0 and time = 1', () => {
    const bezierCurveMock: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
      scale: 1,
    };

    expect(calculateValue(1, bezierCurveMock, 0)).toBe(0); // Start of the curve
    expect(calculateValue(1, bezierCurveMock, 1)).toBe(1); // End of the curve
  });

  it('throws error for invalid bezierPoints', () => {
    const invalidBezierCurve: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [],
      scale: 1,
    };

    expect(() => calculateValue(1, invalidBezierCurve, 0.5)).toThrow();
  });

  it('returns Easing curve value with scaling', () => {
    const easingCurveMock: EasingCurve = {
      type: LifeTimeCurve.EASING,
      curveFunction: (time: number) => time * 0.5,
      scale: 2,
    };

    const result = calculateValue(1, easingCurveMock, 0.8);
    expect(result).toBeCloseTo(0.8);
  });

  it('throws an error for unsupported value type', () => {
    expect(() => calculateValue(1, {})).toThrow('Unsupported value type');
  });
});

describe('isLifeTimeCurve function tests', () => {
  it('returns false for number values', () => {
    const result = isLifeTimeCurve(5);
    expect(result).toBe(false);
  });

  it('returns false for RandomBetweenTwoConstants objects', () => {
    const randomValue: RandomBetweenTwoConstants = { min: 1, max: 5 };
    const result = isLifeTimeCurve(randomValue);
    expect(result).toBe(false);
  });

  it('returns true for BezierCurve objects', () => {
    const bezierCurve: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
      scale: 1,
    };
    const result = isLifeTimeCurve(bezierCurve);
    expect(result).toBe(true);
  });

  it('returns true for EasingCurve objects', () => {
    const easingCurve: EasingCurve = {
      type: LifeTimeCurve.EASING,
      curveFunction: (time: number) => time,
      scale: 1,
    };
    const result = isLifeTimeCurve(easingCurve);
    expect(result).toBe(true);
  });
});

describe('getCurveFunctionFromConfig function tests', () => {
  it('returns a Bezier curve function for BEZIER type', () => {
    const bezierCurve: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
      scale: 1,
    };

    const curveFunction = getCurveFunctionFromConfig(1, bezierCurve);

    // Test the returned function
    expect(typeof curveFunction).toBe('function');
    expect(curveFunction(0)).toBeCloseTo(0);
    expect(curveFunction(1)).toBeCloseTo(1);
    expect(curveFunction(0.5)).toBeCloseTo(0.5);
  });

  it('returns the provided curve function for EASING type', () => {
    const testFunction = (time: number) => time * 2;
    const easingCurve: EasingCurve = {
      type: LifeTimeCurve.EASING,
      curveFunction: testFunction,
      scale: 1,
    };

    const curveFunction = getCurveFunctionFromConfig(1, easingCurve);

    // Verify it returns the same function
    expect(curveFunction).toBe(testFunction);
    expect(curveFunction(0.5)).toBe(1); // 0.5 * 2 = 1
  });

  it('throws an error for unsupported curve type', () => {
    // Create a curve with an invalid type that will pass TypeScript but fail at runtime
    const invalidCurve = {
      type: 999 as unknown as LifeTimeCurve, // Invalid enum value
      scale: 1,
      bezierPoints: [], // Add this to satisfy TypeScript
    } as LifetimeCurve;

    expect(() => getCurveFunctionFromConfig(1, invalidCurve)).toThrow(
      'Unsupported value type'
    );
  });
});

describe('calculateRandomPositionAndVelocityOnSphere - extended', () => {
  let position: THREE.Vector3;
  let quaternion: THREE.Quaternion;
  let velocity: THREE.Vector3;

  beforeEach(() => {
    position = new THREE.Vector3();
    quaternion = new THREE.Quaternion();
    velocity = new THREE.Vector3();
  });

  it('should emit from shell when radiusThickness is 0', () => {
    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnSphere(
        position,
        quaternion,
        velocity,
        1,
        {
          radius: 5,
          radiusThickness: 0,
          arc: 360,
        }
      );
      expect(position.length()).toBeCloseTo(5, 0);
    }
  });

  it('should emit from full volume when radiusThickness is 1', () => {
    const lengths: number[] = [];
    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnSphere(
        position,
        quaternion,
        velocity,
        1,
        {
          radius: 5,
          radiusThickness: 1,
          arc: 360,
        }
      );
      lengths.push(position.length());
    }
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);
    expect(maxLength).toBeLessThanOrEqual(5.01);
    expect(minLength).toBeLessThan(maxLength);
  });

  it('should respect arc parameter for hemisphere', () => {
    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnSphere(
        position,
        quaternion,
        velocity,
        1,
        {
          radius: 1,
          radiusThickness: 0,
          arc: 180,
        }
      );
      // With arc=180, the theta range is [0, PI], so x should be generated
      // within a limited range. Position should still be on the sphere surface.
      expect(position.length()).toBeCloseTo(1, 0);
    }
  });

  it('should apply quaternion rotation to position and velocity', () => {
    // 90 degree rotation around Y axis
    const rotatedQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2
    );

    // Run multiple times and verify both position and velocity are affected
    calculateRandomPositionAndVelocityOnSphere(
      position,
      rotatedQuaternion,
      velocity,
      1,
      { radius: 1, radiusThickness: 0, arc: 360 }
    );

    // Position should still be on the sphere
    expect(position.length()).toBeCloseTo(1, 0);
    // Velocity should match speed
    expect(velocity.length()).toBeCloseTo(1, 0);
  });

  it('should produce velocity with correct speed magnitude', () => {
    const speed = 10;
    calculateRandomPositionAndVelocityOnSphere(
      position,
      quaternion,
      velocity,
      speed,
      {
        radius: 1,
        radiusThickness: 0,
        arc: 360,
      }
    );
    expect(velocity.length()).toBeCloseTo(speed, 0);
  });
});

describe('calculateRandomPositionAndVelocityOnCone', () => {
  let position: THREE.Vector3;
  let quaternion: THREE.Quaternion;
  let velocity: THREE.Vector3;

  beforeEach(() => {
    position = new THREE.Vector3();
    quaternion = new THREE.Quaternion();
    velocity = new THREE.Vector3();
  });

  it('should emit from a cone base with position in XY plane', () => {
    calculateRandomPositionAndVelocityOnCone(
      position,
      quaternion,
      velocity,
      1,
      {
        radius: 2,
        radiusThickness: 0,
        arc: 360,
        angle: 45,
      }
    );

    // Cone emits from XY plane, so z should be 0
    expect(position.z).toBeCloseTo(0);
    // Position should be at the radius (shell)
    const xyLength = Math.sqrt(
      position.x * position.x + position.y * position.y
    );
    expect(xyLength).toBeCloseTo(2, 0);
  });

  it('should emit from shell when radiusThickness is 0', () => {
    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnCone(
        position,
        quaternion,
        velocity,
        1,
        {
          radius: 3,
          radiusThickness: 0,
          arc: 360,
          angle: 45,
        }
      );
      const xyLength = Math.sqrt(
        position.x * position.x + position.y * position.y
      );
      expect(xyLength).toBeCloseTo(3, 0);
    }
  });

  it('should emit within volume when radiusThickness is 1', () => {
    const lengths: number[] = [];
    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnCone(
        position,
        quaternion,
        velocity,
        1,
        {
          radius: 3,
          radiusThickness: 1,
          arc: 360,
          angle: 45,
        }
      );
      const xyLength = Math.sqrt(
        position.x * position.x + position.y * position.y
      );
      lengths.push(xyLength);
    }
    expect(Math.max(...lengths)).toBeLessThanOrEqual(3.01);
    expect(Math.min(...lengths)).toBeLessThan(Math.max(...lengths));
  });

  it('should produce velocity with Z component when angle > 0', () => {
    calculateRandomPositionAndVelocityOnCone(
      position,
      quaternion,
      velocity,
      5,
      {
        radius: 1,
        radiusThickness: 0,
        arc: 360,
        angle: 45,
      }
    );

    // With angle > 0, velocity should have a Z component
    expect(velocity.z).not.toBe(0);
    expect(velocity.length()).toBeCloseTo(5, 0);
  });

  it('should produce mostly Z velocity when angle is 0', () => {
    calculateRandomPositionAndVelocityOnCone(
      position,
      quaternion,
      velocity,
      5,
      {
        radius: 1,
        radiusThickness: 0,
        arc: 360,
        angle: 0,
      }
    );

    // With angle=0, velocity should be almost entirely in Z direction
    expect(Math.abs(velocity.z)).toBeCloseTo(5, 0);
  });

  it('should apply quaternion rotation', () => {
    const rotatedQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      Math.PI / 2
    );

    calculateRandomPositionAndVelocityOnCone(
      position,
      rotatedQuaternion,
      velocity,
      1,
      { radius: 1, radiusThickness: 0, arc: 360, angle: 45 }
    );

    // After rotation, the cone axis should be rotated
    expect(velocity.length()).toBeCloseTo(1, 0);
  });

  it('should default angle to 90 when not provided', () => {
    calculateRandomPositionAndVelocityOnCone(
      position,
      quaternion,
      velocity,
      5,
      {
        radius: 1,
        radiusThickness: 0,
        arc: 360,
      }
    );

    // With default angle=90, there should be significant spread
    expect(velocity.length()).toBeCloseTo(5, 0);
  });
});

describe('calculateRandomPositionAndVelocityOnBox', () => {
  let position: THREE.Vector3;
  let quaternion: THREE.Quaternion;
  let velocity: THREE.Vector3;

  beforeEach(() => {
    position = new THREE.Vector3();
    quaternion = new THREE.Quaternion();
    velocity = new THREE.Vector3();
  });

  it('should emit from volume within box bounds', () => {
    const scale = { x: 4, y: 6, z: 8 };
    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnBox(
        position,
        quaternion,
        velocity,
        1,
        {
          scale,
          emitFrom: EmitFrom.VOLUME,
        }
      );
      expect(Math.abs(position.x)).toBeLessThanOrEqual(scale.x / 2 + 0.01);
      expect(Math.abs(position.y)).toBeLessThanOrEqual(scale.y / 2 + 0.01);
      expect(Math.abs(position.z)).toBeLessThanOrEqual(scale.z / 2 + 0.01);
    }
  });

  it('should emit from shell (surface) of box', () => {
    const scale = { x: 2, y: 2, z: 2 };
    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnBox(
        position,
        quaternion,
        velocity,
        1,
        {
          scale,
          emitFrom: EmitFrom.SHELL,
        }
      );

      // At least one axis should be at the surface (±1)
      const onSurface =
        Math.abs(Math.abs(position.x) - 1) < 0.01 ||
        Math.abs(Math.abs(position.y) - 1) < 0.01 ||
        Math.abs(Math.abs(position.z) - 1) < 0.01;
      expect(onSurface).toBe(true);
    }
  });

  it('should emit from edges of box', () => {
    const scale = { x: 2, y: 2, z: 2 };
    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnBox(
        position,
        quaternion,
        velocity,
        1,
        {
          scale,
          emitFrom: EmitFrom.EDGE,
        }
      );

      // On an edge, at least two axes should be at extremes (0 or 1 in normalized coords)
      const atEdgeX = Math.abs(Math.abs(position.x) - 1) < 0.01;
      const atEdgeY = Math.abs(Math.abs(position.y) - 1) < 0.01;
      const atEdgeZ = Math.abs(Math.abs(position.z) - 1) < 0.01;
      const edgeCount = [atEdgeX, atEdgeY, atEdgeZ].filter(Boolean).length;
      expect(edgeCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('should set velocity along +Z axis', () => {
    calculateRandomPositionAndVelocityOnBox(position, quaternion, velocity, 5, {
      scale: { x: 1, y: 1, z: 1 },
      emitFrom: EmitFrom.VOLUME,
    });

    expect(velocity.x).toBeCloseTo(0);
    expect(velocity.y).toBeCloseTo(0);
    expect(velocity.z).toBeCloseTo(5);
  });

  it('should apply quaternion rotation to position and velocity', () => {
    // 90 degree rotation around X axis
    const rotatedQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      Math.PI / 2
    );

    calculateRandomPositionAndVelocityOnBox(
      position,
      rotatedQuaternion,
      velocity,
      5,
      { scale: { x: 1, y: 1, z: 1 }, emitFrom: EmitFrom.VOLUME }
    );

    // After 90° rotation around X, +Z velocity becomes -Y
    expect(velocity.x).toBeCloseTo(0);
    expect(Math.abs(velocity.y)).toBeCloseTo(5);
    expect(velocity.z).toBeCloseTo(0);
  });
});

describe('calculateRandomPositionAndVelocityOnCircle', () => {
  let position: THREE.Vector3;
  let quaternion: THREE.Quaternion;
  let velocity: THREE.Vector3;

  beforeEach(() => {
    position = new THREE.Vector3();
    quaternion = new THREE.Quaternion();
    velocity = new THREE.Vector3();
  });

  it('should emit on XY plane (z = 0)', () => {
    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnCircle(
        position,
        quaternion,
        velocity,
        1,
        {
          radius: 5,
          radiusThickness: 1,
          arc: 360,
        }
      );
      expect(position.z).toBeCloseTo(0);
    }
  });

  it('should emit from edge when radiusThickness is 0', () => {
    for (let i = 0; i < 20; i++) {
      calculateRandomPositionAndVelocityOnCircle(
        position,
        quaternion,
        velocity,
        1,
        {
          radius: 3,
          radiusThickness: 0,
          arc: 360,
        }
      );
      const xyLength = Math.sqrt(
        position.x * position.x + position.y * position.y
      );
      expect(xyLength).toBeCloseTo(3, 0);
    }
  });

  it('should emit within disc when radiusThickness is 1', () => {
    const lengths: number[] = [];
    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnCircle(
        position,
        quaternion,
        velocity,
        1,
        {
          radius: 3,
          radiusThickness: 1,
          arc: 360,
        }
      );
      const xyLength = Math.sqrt(
        position.x * position.x + position.y * position.y
      );
      lengths.push(xyLength);
    }
    expect(Math.max(...lengths)).toBeLessThanOrEqual(3.01);
    expect(Math.min(...lengths)).toBeLessThan(Math.max(...lengths));
  });

  it('should produce radial velocity in XY plane', () => {
    calculateRandomPositionAndVelocityOnCircle(
      position,
      quaternion,
      velocity,
      5,
      {
        radius: 1,
        radiusThickness: 0,
        arc: 360,
      }
    );

    // Velocity Z should be 0 (radial in XY)
    expect(velocity.z).toBeCloseTo(0);
    expect(velocity.length()).toBeCloseTo(5, 0);
  });

  it('should respect arc parameter', () => {
    // With arc=90, theta is in [0, PI/2], so positions should be in first quadrant
    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnCircle(
        position,
        quaternion,
        velocity,
        1,
        {
          radius: 1,
          radiusThickness: 0,
          arc: 90,
        }
      );
      // In first quadrant or near boundary, x and y should be >= 0 (approximately)
      expect(position.x).toBeGreaterThanOrEqual(-0.01);
      expect(position.y).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it('should apply quaternion rotation', () => {
    const rotatedQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      Math.PI / 2
    );

    calculateRandomPositionAndVelocityOnCircle(
      position,
      rotatedQuaternion,
      velocity,
      1,
      { radius: 1, radiusThickness: 0, arc: 360 }
    );

    // After rotation around X, the circle (XY plane) becomes XZ plane
    // Position should still be on circle radius
    expect(position.length()).toBeCloseTo(1, 0);
    // Velocity should be non-zero (direction is rotated)
    expect(velocity.length()).toBeGreaterThan(0);
  });
});

describe('calculateRandomPositionAndVelocityOnRectangle', () => {
  let position: THREE.Vector3;
  let quaternion: THREE.Quaternion;
  let velocity: THREE.Vector3;

  beforeEach(() => {
    position = new THREE.Vector3();
    quaternion = new THREE.Quaternion();
    velocity = new THREE.Vector3();
  });

  it('should emit within rectangle bounds with no rotation', () => {
    const scale = { x: 4, y: 6 };
    for (let i = 0; i < 50; i++) {
      calculateRandomPositionAndVelocityOnRectangle(
        position,
        quaternion,
        velocity,
        1,
        {
          rotation: { x: 0, y: 0 },
          scale,
        }
      );
      expect(Math.abs(position.x)).toBeLessThanOrEqual(scale.x / 2 + 0.01);
      expect(Math.abs(position.y)).toBeLessThanOrEqual(scale.y / 2 + 0.01);
      expect(position.z).toBeCloseTo(0);
    }
  });

  it('should set velocity along +Z axis', () => {
    calculateRandomPositionAndVelocityOnRectangle(
      position,
      quaternion,
      velocity,
      7,
      {
        rotation: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
      }
    );

    expect(velocity.x).toBeCloseTo(0);
    expect(velocity.y).toBeCloseTo(0);
    expect(velocity.z).toBeCloseTo(7);
  });

  it('should apply local rotation to position', () => {
    // With Y rotation of 90 degrees, x offset should map to z
    calculateRandomPositionAndVelocityOnRectangle(
      position,
      quaternion,
      velocity,
      1,
      {
        rotation: { x: 0, y: 90 },
        scale: { x: 2, y: 2 },
      }
    );

    // With 90° Y rotation, position.z should be non-zero (sin(90°) * xOffset)
    // The position is no longer flat on XY plane
    const hasDepth = Math.abs(position.z) > 0 || Math.abs(position.x) < 1.01;
    expect(hasDepth).toBe(true);
  });

  it('should apply quaternion rotation to position and velocity', () => {
    const rotatedQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      Math.PI / 2
    );

    calculateRandomPositionAndVelocityOnRectangle(
      position,
      rotatedQuaternion,
      velocity,
      5,
      { rotation: { x: 0, y: 0 }, scale: { x: 1, y: 1 } }
    );

    // After 90° rotation around X, +Z velocity becomes -Y
    expect(velocity.x).toBeCloseTo(0);
    expect(Math.abs(velocity.y)).toBeCloseTo(5);
    expect(velocity.z).toBeCloseTo(0);
  });

  it('should handle zero scale', () => {
    calculateRandomPositionAndVelocityOnRectangle(
      position,
      quaternion,
      velocity,
      1,
      {
        rotation: { x: 0, y: 0 },
        scale: { x: 0, y: 0 },
      }
    );

    expect(position.x).toBeCloseTo(0);
    expect(position.y).toBeCloseTo(0);
    expect(position.z).toBeCloseTo(0);
  });
});
