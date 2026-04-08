import { SimulationBackend } from './three-particles-enums.js';

/**
 * Checks whether the given renderer supports GPU compute dispatches.
 *
 * Uses duck-typing: a renderer is considered WebGPU-capable when it exposes
 * a `.compute()` method and a `.hasFeature()` method (both present on
 * `THREE.WebGPURenderer` but absent from `THREE.WebGLRenderer`).
 *
 * @param renderer - Any Three.js renderer instance.
 * @returns `true` when the renderer supports compute shaders.
 */
export function isComputeCapableRenderer(renderer: unknown): boolean {
  return (
    renderer !== null &&
    renderer !== undefined &&
    typeof renderer === 'object' &&
    'compute' in renderer &&
    typeof (renderer as Record<string, unknown>).compute === 'function' &&
    'hasFeature' in renderer &&
    typeof (renderer as Record<string, unknown>).hasFeature === 'function'
  );
}

/**
 * Resolves the effective simulation backend based on the user's preference
 * and the capabilities of the provided renderer.
 *
 * | Preference | WebGPURenderer | WebGLRenderer |
 * |------------|---------------|---------------|
 * | `AUTO`     | `GPU`         | `CPU`         |
 * | `CPU`      | `CPU`         | `CPU`         |
 * | `GPU`      | `GPU`         | `CPU` (fallback) |
 *
 * @param renderer - The Three.js renderer instance used for rendering.
 * @param preference - The user-specified simulation backend preference.
 * @returns The resolved {@link SimulationBackend} (`CPU` or `GPU`).
 */
export function resolveSimulationBackend(
  renderer: unknown,
  preference: SimulationBackend = SimulationBackend.AUTO
): SimulationBackend.CPU | SimulationBackend.GPU {
  const gpuCapable = isComputeCapableRenderer(renderer);

  if (preference === SimulationBackend.CPU) {
    return SimulationBackend.CPU;
  }

  if (preference === SimulationBackend.GPU) {
    return gpuCapable ? SimulationBackend.GPU : SimulationBackend.CPU;
  }

  // AUTO: use GPU when available
  return gpuCapable ? SimulationBackend.GPU : SimulationBackend.CPU;
}
