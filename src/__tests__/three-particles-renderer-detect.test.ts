import { SimulationBackend } from '../js/effects/three-particles/three-particles-enums.js';
import {
  isComputeCapableRenderer,
  resolveSimulationBackend,
} from '../js/effects/three-particles/three-particles-renderer-detect.js';

// ─── Mock renderers ──────────────────────────────────────────────────────────

/** Minimal mock of a WebGLRenderer (no compute method). */
function createMockWebGLRenderer() {
  return { render: jest.fn(), setSize: jest.fn() };
}

/** Minimal mock of a WebGPURenderer (has compute + hasFeature methods). */
function createMockWebGPURenderer() {
  return {
    render: jest.fn(),
    compute: jest.fn(),
    hasFeature: jest.fn().mockReturnValue(true),
    setSize: jest.fn(),
  };
}

// ─── isComputeCapableRenderer ────────────────────────────────────────────────

describe('isComputeCapableRenderer', () => {
  it('returns false for null', () => {
    expect(isComputeCapableRenderer(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isComputeCapableRenderer(undefined)).toBe(false);
  });

  it('returns false for a plain object without compute', () => {
    expect(isComputeCapableRenderer({})).toBe(false);
  });

  it('returns false for a WebGLRenderer mock', () => {
    expect(isComputeCapableRenderer(createMockWebGLRenderer())).toBe(false);
  });

  it('returns true for a WebGPURenderer mock', () => {
    expect(isComputeCapableRenderer(createMockWebGPURenderer())).toBe(true);
  });

  it('returns false when compute exists but is not a function', () => {
    expect(
      isComputeCapableRenderer({ compute: 42, hasFeature: jest.fn() })
    ).toBe(false);
  });

  it('returns false when compute is a function but hasFeature is missing', () => {
    expect(isComputeCapableRenderer({ compute: jest.fn() })).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isComputeCapableRenderer(42)).toBe(false);
    expect(isComputeCapableRenderer('renderer')).toBe(false);
    expect(isComputeCapableRenderer(true)).toBe(false);
  });
});

// ─── resolveSimulationBackend ────────────────────────────────────────────────

describe('resolveSimulationBackend', () => {
  describe('with WebGLRenderer (no compute)', () => {
    const renderer = createMockWebGLRenderer();

    it('resolves AUTO to CPU', () => {
      expect(resolveSimulationBackend(renderer, SimulationBackend.AUTO)).toBe(
        SimulationBackend.CPU
      );
    });

    it('resolves CPU to CPU', () => {
      expect(resolveSimulationBackend(renderer, SimulationBackend.CPU)).toBe(
        SimulationBackend.CPU
      );
    });

    it('resolves GPU to CPU (fallback)', () => {
      expect(resolveSimulationBackend(renderer, SimulationBackend.GPU)).toBe(
        SimulationBackend.CPU
      );
    });

    it('defaults to AUTO when preference is omitted', () => {
      expect(resolveSimulationBackend(renderer)).toBe(SimulationBackend.CPU);
    });
  });

  describe('with WebGPURenderer (compute capable)', () => {
    const renderer = createMockWebGPURenderer();

    it('resolves AUTO to GPU', () => {
      expect(resolveSimulationBackend(renderer, SimulationBackend.AUTO)).toBe(
        SimulationBackend.GPU
      );
    });

    it('resolves CPU to CPU (explicit override)', () => {
      expect(resolveSimulationBackend(renderer, SimulationBackend.CPU)).toBe(
        SimulationBackend.CPU
      );
    });

    it('resolves GPU to GPU', () => {
      expect(resolveSimulationBackend(renderer, SimulationBackend.GPU)).toBe(
        SimulationBackend.GPU
      );
    });

    it('defaults to AUTO when preference is omitted', () => {
      expect(resolveSimulationBackend(renderer)).toBe(SimulationBackend.GPU);
    });
  });

  describe('with null/undefined renderer', () => {
    it('resolves AUTO to CPU for null renderer', () => {
      expect(resolveSimulationBackend(null, SimulationBackend.AUTO)).toBe(
        SimulationBackend.CPU
      );
    });

    it('resolves GPU to CPU for undefined renderer', () => {
      expect(resolveSimulationBackend(undefined, SimulationBackend.GPU)).toBe(
        SimulationBackend.CPU
      );
    });
  });
});
