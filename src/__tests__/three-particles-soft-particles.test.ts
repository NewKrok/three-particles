import * as THREE from 'three';
import { RendererType } from '../js/effects/three-particles/three-particles-enums.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import type { ParticleSystem } from '../js/effects/three-particles/types.js';

/**
 * Helper: create a particle system with soft particles config.
 */
const createSystemWithSoftParticles = (
  rendererType: RendererType = RendererType.POINTS,
  softParticles: Record<string, unknown> = {},
  extraConfig: Record<string, unknown> = {},
  startTime = 1000
) => {
  const ps = createParticleSystem(
    {
      maxParticles: 10,
      duration: 5,
      looping: true,
      startLifetime: 2,
      startSpeed: 1,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      emission: { rateOverTime: 10 },
      renderer: {
        rendererType,
        softParticles,
        ...(rendererType === RendererType.TRAIL
          ? { trail: { length: 4 } }
          : {}),
        ...(rendererType === RendererType.MESH
          ? { mesh: { geometry: new THREE.BoxGeometry(1, 1, 1) } }
          : {}),
      },
      ...extraConfig,
    } as any,
    startTime
  );
  return ps;
};

/**
 * Helper: get the ShaderMaterial from a particle system.
 */
const getMaterial = (ps: ParticleSystem): THREE.ShaderMaterial => {
  const obj = ps.instance as THREE.Mesh | THREE.Points;
  return obj.material as THREE.ShaderMaterial;
};

/**
 * Helper: get the trail mesh material from a trail particle system.
 */
const getTrailMaterial = (ps: ParticleSystem): THREE.ShaderMaterial => {
  const points = ps.instance as THREE.Points;
  const trailMesh = points.children.find(
    (c) => c instanceof THREE.Mesh
  ) as THREE.Mesh;
  return trailMesh.material as THREE.ShaderMaterial;
};

describe('Soft Particles (depth-based fade)', () => {
  describe('defaults', () => {
    it('should default softParticlesEnabled to false', () => {
      const ps = createSystemWithSoftParticles();
      const mat = getMaterial(ps);
      expect(mat.uniforms.softParticlesEnabled.value).toBe(false);
      ps.dispose();
    });

    it('should default softParticlesIntensity to 1.0', () => {
      const ps = createSystemWithSoftParticles();
      const mat = getMaterial(ps);
      expect(mat.uniforms.softParticlesIntensity.value).toBe(1.0);
      ps.dispose();
    });

    it('should default sceneDepthTexture to null', () => {
      const ps = createSystemWithSoftParticles();
      const mat = getMaterial(ps);
      expect(mat.uniforms.sceneDepthTexture.value).toBeNull();
      ps.dispose();
    });

    it('should default cameraNearFar to (0.1, 1000)', () => {
      const ps = createSystemWithSoftParticles();
      const mat = getMaterial(ps);
      const nf = mat.uniforms.cameraNearFar.value as THREE.Vector2;
      expect(nf.x).toBeCloseTo(0.1);
      expect(nf.y).toBeCloseTo(1000.0);
      ps.dispose();
    });
  });

  describe('enabled with depthTexture', () => {
    it('should set softParticlesEnabled to true when enabled and depthTexture provided', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.POINTS, {
        enabled: true,
        intensity: 2.5,
        depthTexture: depthTex,
      });
      const mat = getMaterial(ps);
      expect(mat.uniforms.softParticlesEnabled.value).toBe(true);
      expect(mat.uniforms.softParticlesIntensity.value).toBe(2.5);
      expect(mat.uniforms.sceneDepthTexture.value).toBe(depthTex);
      ps.dispose();
    });

    it('should gracefully disable when enabled but no depthTexture provided', () => {
      const ps = createSystemWithSoftParticles(RendererType.POINTS, {
        enabled: true,
        intensity: 2.0,
      });
      const mat = getMaterial(ps);
      expect(mat.uniforms.softParticlesEnabled.value).toBe(false);
      ps.dispose();
    });

    it('should disable when enabled is false even with depthTexture', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.POINTS, {
        enabled: false,
        depthTexture: depthTex,
      });
      const mat = getMaterial(ps);
      expect(mat.uniforms.softParticlesEnabled.value).toBe(false);
      ps.dispose();
    });

    it('should use default intensity when not specified', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.POINTS, {
        enabled: true,
        depthTexture: depthTex,
      });
      const mat = getMaterial(ps);
      expect(mat.uniforms.softParticlesIntensity.value).toBe(1.0);
      ps.dispose();
    });

    it('should clamp intensity to minimum 0.001 when set to zero', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.POINTS, {
        enabled: true,
        intensity: 0,
        depthTexture: depthTex,
      });
      const mat = getMaterial(ps);
      expect(mat.uniforms.softParticlesIntensity.value).toBeCloseTo(0.001);
      ps.dispose();
    });

    it('should clamp negative intensity to minimum 0.001', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.POINTS, {
        enabled: true,
        intensity: -5,
        depthTexture: depthTex,
      });
      const mat = getMaterial(ps);
      expect(mat.uniforms.softParticlesIntensity.value).toBeCloseTo(0.001);
      ps.dispose();
    });
  });

  describe('all renderer types include soft particle uniforms', () => {
    const rendererTypes = [
      RendererType.POINTS,
      RendererType.INSTANCED,
      RendererType.MESH,
    ];

    rendererTypes.forEach((type) => {
      it(`should include soft particle uniforms for ${type}`, () => {
        const depthTex = new THREE.DepthTexture(256, 256);
        const ps = createSystemWithSoftParticles(type, {
          enabled: true,
          depthTexture: depthTex,
        });
        const mat = getMaterial(ps);
        expect(mat.uniforms.softParticlesEnabled).toBeDefined();
        expect(mat.uniforms.softParticlesEnabled.value).toBe(true);
        expect(mat.uniforms.softParticlesIntensity).toBeDefined();
        expect(mat.uniforms.sceneDepthTexture).toBeDefined();
        expect(mat.uniforms.sceneDepthTexture.value).toBe(depthTex);
        expect(mat.uniforms.cameraNearFar).toBeDefined();
        ps.dispose();
      });
    });

    it('should include soft particle uniforms for TRAIL renderer', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.TRAIL, {
        enabled: true,
        depthTexture: depthTex,
      });
      const mat = getTrailMaterial(ps);
      expect(mat.uniforms.softParticlesEnabled.value).toBe(true);
      expect(mat.uniforms.softParticlesIntensity.value).toBe(1.0);
      expect(mat.uniforms.sceneDepthTexture.value).toBe(depthTex);
      expect(mat.uniforms.cameraNearFar).toBeDefined();
      ps.dispose();
    });
  });

  describe('shader code contains soft particle logic', () => {
    it('should include linearizeDepth function in POINTS fragment shader', () => {
      const ps = createSystemWithSoftParticles(RendererType.POINTS);
      const mat = getMaterial(ps);
      expect(mat.fragmentShader).toContain('linearizeDepth');
      expect(mat.fragmentShader).toContain('softParticlesEnabled');
      expect(mat.fragmentShader).toContain('sceneDepthTexture');
      ps.dispose();
    });

    it('should include linearizeDepth function in INSTANCED fragment shader', () => {
      const ps = createSystemWithSoftParticles(RendererType.INSTANCED);
      const mat = getMaterial(ps);
      expect(mat.fragmentShader).toContain('linearizeDepth');
      expect(mat.fragmentShader).toContain('softParticlesEnabled');
      ps.dispose();
    });

    it('should include linearizeDepth function in MESH fragment shader', () => {
      const ps = createSystemWithSoftParticles(RendererType.MESH);
      const mat = getMaterial(ps);
      expect(mat.fragmentShader).toContain('linearizeDepth');
      expect(mat.fragmentShader).toContain('softParticlesEnabled');
      ps.dispose();
    });

    it('should include linearizeDepth function in TRAIL fragment shader', () => {
      const ps = createSystemWithSoftParticles(RendererType.TRAIL);
      const mat = getTrailMaterial(ps);
      expect(mat.fragmentShader).toContain('linearizeDepth');
      expect(mat.fragmentShader).toContain('softParticlesEnabled');
      ps.dispose();
    });

    it('should include vViewZ varying in POINTS vertex shader', () => {
      const ps = createSystemWithSoftParticles(RendererType.POINTS);
      const mat = getMaterial(ps);
      expect(mat.vertexShader).toContain('vViewZ');
      ps.dispose();
    });

    it('should include vViewZ varying in INSTANCED vertex shader', () => {
      const ps = createSystemWithSoftParticles(RendererType.INSTANCED);
      const mat = getMaterial(ps);
      expect(mat.vertexShader).toContain('vViewZ');
      ps.dispose();
    });

    it('should include vViewZ varying in MESH vertex shader', () => {
      const ps = createSystemWithSoftParticles(RendererType.MESH);
      const mat = getMaterial(ps);
      expect(mat.vertexShader).toContain('vViewZ');
      ps.dispose();
    });

    it('should include vViewZ varying in TRAIL vertex shader', () => {
      const ps = createSystemWithSoftParticles(RendererType.TRAIL);
      const mat = getTrailMaterial(ps);
      expect(mat.vertexShader).toContain('vViewZ');
      ps.dispose();
    });
  });

  describe('onBeforeRender callback', () => {
    it('should set onBeforeRender when soft particles enabled for POINTS', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.POINTS, {
        enabled: true,
        depthTexture: depthTex,
      });
      // Points renderer normally has no onBeforeRender; with soft particles it should
      expect(typeof ps.instance.onBeforeRender).toBe('function');
      ps.dispose();
    });

    it('should NOT set custom onBeforeRender when soft particles disabled for POINTS', () => {
      const ps = createSystemWithSoftParticles(RendererType.POINTS, {
        enabled: false,
      });
      // Default THREE.Object3D.prototype.onBeforeRender is a noop function
      // When no instancing and no soft particles, we should not have set a custom one
      // Just ensure it doesn't throw
      expect(() => {
        ps.instance.onBeforeRender(
          {} as THREE.WebGLRenderer,
          {} as THREE.Scene,
          {} as THREE.Camera,
          {} as THREE.BufferGeometry,
          {} as THREE.Material,
          null as any
        );
      }).not.toThrow();
      ps.dispose();
    });

    it('should update cameraNearFar from a PerspectiveCamera via onBeforeRender', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.INSTANCED, {
        enabled: true,
        depthTexture: depthTex,
      });
      const mat = getMaterial(ps);

      const camera = new THREE.PerspectiveCamera(75, 1, 0.5, 500);
      const mockRenderer = {
        getSize: () => new THREE.Vector2(1920, 1080),
        getPixelRatio: () => 1,
      } as unknown as THREE.WebGLRenderer;

      ps.instance.onBeforeRender(
        mockRenderer,
        {} as THREE.Scene,
        camera,
        ps.instance.geometry,
        mat,
        null as any
      );

      const nf = mat.uniforms.cameraNearFar.value as THREE.Vector2;
      expect(nf.x).toBe(0.5);
      expect(nf.y).toBe(500);
      ps.dispose();
    });

    it('should not crash with OrthographicCamera (graceful skip)', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.INSTANCED, {
        enabled: true,
        depthTexture: depthTex,
      });
      const mat = getMaterial(ps);

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      const mockRenderer = {
        getSize: () => new THREE.Vector2(1920, 1080),
        getPixelRatio: () => 1,
      } as unknown as THREE.WebGLRenderer;

      // Should not throw — the ortho camera guard should skip the update
      expect(() => {
        ps.instance.onBeforeRender(
          mockRenderer,
          {} as THREE.Scene,
          camera,
          ps.instance.geometry,
          mat,
          null as any
        );
      }).not.toThrow();

      // cameraNearFar should remain at default since ortho camera is skipped
      const nf = mat.uniforms.cameraNearFar.value as THREE.Vector2;
      expect(nf.x).toBeCloseTo(0.1);
      expect(nf.y).toBeCloseTo(1000.0);
      ps.dispose();
    });

    it('should update cameraNearFar on trail mesh onBeforeRender', () => {
      const depthTex = new THREE.DepthTexture(256, 256);
      const ps = createSystemWithSoftParticles(RendererType.TRAIL, {
        enabled: true,
        depthTexture: depthTex,
      });

      const trailMesh = ps.instance.children.find(
        (c) => c instanceof THREE.Mesh
      ) as THREE.Mesh;
      const trailMat = trailMesh.material as THREE.ShaderMaterial;

      const camera = new THREE.PerspectiveCamera(75, 1, 0.3, 800);
      // getWorldPosition needs a proper matrixWorld
      camera.updateMatrixWorld(true);

      trailMesh.onBeforeRender(
        {} as THREE.WebGLRenderer,
        {} as THREE.Scene,
        camera,
        trailMesh.geometry,
        trailMat,
        null as any
      );

      const nf = trailMat.uniforms.cameraNearFar.value as THREE.Vector2;
      expect(nf.x).toBe(0.3);
      expect(nf.y).toBe(800);
      ps.dispose();
    });
  });
});
