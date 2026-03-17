/**
 * Performance benchmark suite for @newkrok/three-particles
 *
 * Measures:
 * 1. Particle system creation time
 * 2. Update loop performance (single system, many particles)
 * 3. Multiple systems update performance
 * 4. Burst emission performance
 *
 * Usage:
 *   node --experimental-vm-modules benchmarks/run.js
 *   node --experimental-vm-modules benchmarks/run.js --json          # JSON output
 *   node --experimental-vm-modules benchmarks/run.js --compare baseline.json  # Compare
 */

import { createParticleSystem } from '../dist/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function measure(name, fn, iterations = 100) {
  // Warmup
  for (let i = 0; i < 5; i++) fn();

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)];
  const min = times[0];
  const max = times[times.length - 1];

  return { name, iterations, median, mean, p95, min, max };
}

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  return `${ms.toFixed(2)}ms`;
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

function benchCreateSystem() {
  return measure('createParticleSystem (default config)', () => {
    const system = createParticleSystem({
      maxParticles: 100,
      startLifetime: 2,
      startSpeed: 1,
      startSize: 0.5,
      emission: { rateOverTime: 20 },
    });
    system.dispose();
  });
}

function benchCreateSystemHighCount() {
  return measure('createParticleSystem (1000 particles)', () => {
    const system = createParticleSystem({
      maxParticles: 1000,
      startLifetime: 2,
      startSpeed: 1,
      startSize: 0.5,
      emission: { rateOverTime: 100 },
    });
    system.dispose();
  });
}

function benchUpdateLoop() {
  const system = createParticleSystem({
    maxParticles: 500,
    startLifetime: 5,
    startSpeed: 2,
    startSize: 0.5,
    emission: { rateOverTime: 100 },
    looping: true,
  });

  // Fill particles first
  let now = 1000;
  for (let i = 0; i < 100; i++) {
    now += 16;
    system.update({ now, delta: 0.016, elapsed: (now - 1000) / 1000 });
  }

  const result = measure(
    'update loop (500 particles, single system)',
    () => {
      now += 16;
      system.update({ now, delta: 0.016, elapsed: (now - 1000) / 1000 });
    },
    500
  );

  system.dispose();
  return result;
}

function benchUpdateMultipleSystems() {
  const systems = [];
  for (let i = 0; i < 10; i++) {
    systems.push(
      createParticleSystem({
        maxParticles: 100,
        startLifetime: 3,
        startSpeed: 1,
        startSize: 0.3,
        emission: { rateOverTime: 20 },
        looping: true,
      })
    );
  }

  // Fill particles
  let now = 1000;
  for (let i = 0; i < 50; i++) {
    now += 16;
    const cycleData = { now, delta: 0.016, elapsed: (now - 1000) / 1000 };
    systems.forEach((s) => s.update(cycleData));
  }

  const result = measure(
    'update loop (10 systems × 100 particles)',
    () => {
      now += 16;
      const cycleData = { now, delta: 0.016, elapsed: (now - 1000) / 1000 };
      systems.forEach((s) => s.update(cycleData));
    },
    200
  );

  systems.forEach((s) => s.dispose());
  return result;
}

function benchBurstEmission() {
  return measure(
    'burst emission (100 particles)',
    () => {
      const system = createParticleSystem({
        maxParticles: 150,
        startLifetime: 2,
        startSpeed: 5,
        startSize: 0.3,
        emission: {
          rateOverTime: 0,
          bursts: [{ time: 0, count: 100 }],
        },
        looping: false,
      });

      // Trigger burst
      system.update({ now: 1016, delta: 0.016, elapsed: 0.016 });
      system.dispose();
    },
    100
  );
}

function benchModifiers() {
  const system = createParticleSystem({
    maxParticles: 300,
    startLifetime: 3,
    startSpeed: 2,
    startSize: 0.5,
    emission: { rateOverTime: 80 },
    looping: true,
    sizeOverLifetime: {
      isActive: true,
      lifetimeCurve: {
        type: 'BEZIER',
        scale: 1,
        bezierPoints: [
          { x: 0, y: 1, percentage: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 0, percentage: 1 },
        ],
      },
    },
    opacityOverLifetime: {
      isActive: true,
      lifetimeCurve: {
        type: 'BEZIER',
        scale: 1,
        bezierPoints: [
          { x: 0, y: 1, percentage: 0 },
          { x: 0.7, y: 0.8 },
          { x: 1, y: 0, percentage: 1 },
        ],
      },
    },
    velocityOverLifetime: {
      isActive: true,
      linear: { x: 0, y: 1, z: 0 },
      orbital: { x: 0, y: 45, z: 0 },
    },
    rotationOverLifetime: {
      isActive: true,
      min: -90,
      max: 90,
    },
  });

  // Fill particles
  let now = 1000;
  for (let i = 0; i < 60; i++) {
    now += 16;
    system.update({ now, delta: 0.016, elapsed: (now - 1000) / 1000 });
  }

  const result = measure(
    'update with all modifiers (300 particles)',
    () => {
      now += 16;
      system.update({ now, delta: 0.016, elapsed: (now - 1000) / 1000 });
    },
    300
  );

  system.dispose();
  return result;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const compareIdx = args.indexOf('--compare');

const results = [
  benchCreateSystem(),
  benchCreateSystemHighCount(),
  benchUpdateLoop(),
  benchUpdateMultipleSystems(),
  benchBurstEmission(),
  benchModifiers(),
];

const output = {
  timestamp: new Date().toISOString(),
  nodeVersion: process.version,
  results: results.map((r) => ({
    name: r.name,
    iterations: r.iterations,
    median_ms: parseFloat(r.median.toFixed(4)),
    mean_ms: parseFloat(r.mean.toFixed(4)),
    p95_ms: parseFloat(r.p95.toFixed(4)),
    min_ms: parseFloat(r.min.toFixed(4)),
    max_ms: parseFloat(r.max.toFixed(4)),
  })),
};

if (jsonMode) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log('\n=== Three Particles Benchmark ===\n');
  console.log(`Node: ${process.version}`);
  console.log(`Date: ${output.timestamp}\n`);

  const nameWidth = Math.max(...results.map((r) => r.name.length)) + 2;

  for (const r of results) {
    const name = r.name.padEnd(nameWidth);
    console.log(
      `  ${name} median: ${formatMs(r.median).padStart(8)}  mean: ${formatMs(r.mean).padStart(8)}  p95: ${formatMs(r.p95).padStart(8)}  (${r.iterations} iterations)`
    );
  }

  console.log('');
}

// Compare mode
if (compareIdx !== -1 && args[compareIdx + 1]) {
  const fs = await import('fs');
  const baselinePath = args[compareIdx + 1];

  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    const THRESHOLD = 0.10; // 10% regression threshold

    console.log('\n=== Comparison vs Baseline ===\n');

    let hasRegression = false;

    for (const current of output.results) {
      const base = baseline.results.find((b) => b.name === current.name);
      if (!base) {
        console.log(`  [NEW] ${current.name}: ${formatMs(current.median_ms)}`);
        continue;
      }

      const diff = (current.median_ms - base.median_ms) / base.median_ms;
      const diffPct = (diff * 100).toFixed(1);
      const status =
        diff > THRESHOLD ? '❌ REGRESSION' : diff < -THRESHOLD ? '✅ FASTER' : '✅ OK';

      if (diff > THRESHOLD) hasRegression = true;

      console.log(
        `  ${status}  ${current.name}: ${formatMs(current.median_ms)} (was ${formatMs(base.median_ms)}, ${diff > 0 ? '+' : ''}${diffPct}%)`
      );
    }

    if (hasRegression) {
      console.log('\n⚠️  Performance regression detected (>10% slower)');
      process.exit(1);
    } else {
      console.log('\n✅ All benchmarks within threshold');
    }
  } catch (e) {
    console.error(`Could not read baseline: ${e.message}`);
    process.exit(1);
  }
}
