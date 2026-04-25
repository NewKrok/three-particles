import * as THREE from 'three';
import {
  linearToSRGB,
  sRGBToLinear,
} from '../js/effects/three-particles/color-utils.js';

describe('sRGBToLinear', () => {
  it('returns 0 for 0', () => {
    expect(sRGBToLinear(0)).toBe(0);
  });

  it('returns 1 for 1', () => {
    expect(sRGBToLinear(1)).toBeCloseTo(1, 10);
  });

  it('uses the linear segment below 0.04045', () => {
    // c / 12.92
    expect(sRGBToLinear(0.04)).toBeCloseTo(0.04 / 12.92, 10);
    expect(sRGBToLinear(0.02)).toBeCloseTo(0.02 / 12.92, 10);
  });

  it('uses the gamma segment above 0.04045', () => {
    // Spot-check: sRGB 0.5 → linear ~0.2140
    expect(sRGBToLinear(0.5)).toBeCloseTo(0.21404114048223255, 10);
  });

  it('matches THREE.Color sRGB-to-linear conversion at representative sample points', () => {
    // Cross-check against three.js's own implementation. Any drift here
    // would produce subtle rendering mismatches with non-particle
    // materials in the same scene. THREE.Color.setRGB(..., SRGBColorSpace)
    // converts the input from sRGB to the color's internal linear storage.
    const samples = [0, 0.02, 0.04045, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    const color = new THREE.Color();
    for (const s of samples) {
      color.setRGB(s, s, s, THREE.SRGBColorSpace);
      expect(sRGBToLinear(s)).toBeCloseTo(color.r, 10);
    }
  });
});

describe('linearToSRGB', () => {
  it('returns 0 for 0', () => {
    expect(linearToSRGB(0)).toBe(0);
  });

  it('returns 1 for 1', () => {
    expect(linearToSRGB(1)).toBeCloseTo(1, 10);
  });

  it('is the inverse of sRGBToLinear', () => {
    const samples = [0, 0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99, 1];
    for (const s of samples) {
      expect(linearToSRGB(sRGBToLinear(s))).toBeCloseTo(s, 10);
      expect(sRGBToLinear(linearToSRGB(s))).toBeCloseTo(s, 10);
    }
  });

  it('matches THREE.Color linear-to-sRGB conversion at representative sample points', () => {
    // THREE.Color.getRGB(target, SRGBColorSpace) converts the color's
    // internal linear storage to sRGB. Three.js uses a fast-path
    // approximation, so we allow a small tolerance well below 8-bit
    // framebuffer quantisation (1/255 ≈ 0.004).
    const samples = [0, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    const color = new THREE.Color();
    const out = { r: 0, g: 0, b: 0 };
    for (const s of samples) {
      color.setRGB(s, s, s, THREE.LinearSRGBColorSpace);
      color.getRGB(out, THREE.SRGBColorSpace);
      expect(linearToSRGB(s)).toBeCloseTo(out.r, 4);
    }
  });
});
