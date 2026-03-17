import * as THREE from "three";

// Example configurations
const examples = [
  {
    id: "basic",
    title: "Basic Particles",
    description: "Simple upward particle stream with default settings.",
    tags: ["beginner"],
    config: {
      duration: 5,
      looping: true,
      maxParticles: 100,
      startLifetime: 2,
      startSpeed: 2,
      startSize: 0.15,
      startColor: {
        min: { r: 0.4, g: 0.7, b: 1.0 },
        max: { r: 0.6, g: 0.9, b: 1.0 },
      },
      emission: { rateOverTime: 20 },
      shape: {
        shape: "CONE",
        cone: { angle: 0.3, radius: 0.3 },
      },
    },
  },
  {
    id: "fire",
    title: "Fire",
    description:
      "Realistic fire effect with color over lifetime and additive blending.",
    tags: ["intermediate", "color"],
    config: {
      duration: 5,
      looping: true,
      maxParticles: 200,
      startLifetime: { min: 0.5, max: 1.5 },
      startSpeed: { min: 1, max: 3 },
      startSize: { min: 0.2, max: 0.5 },
      startColor: {
        min: { r: 1.0, g: 0.2, b: 0.0 },
        max: { r: 1.0, g: 0.8, b: 0.0 },
      },
      gravity: -0.5,
      emission: { rateOverTime: 60 },
      shape: {
        shape: "CONE",
        cone: { angle: 0.15, radius: 0.2 },
      },
      renderer: {
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        discardBackgroundColor: false,
        backgroundColorTolerance: 1,
        backgroundColor: { r: 0, g: 0, b: 0 },
      },
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: "BEZIER",
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 0.5, y: 0.6 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: "BEZIER",
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 0.6, y: 0.8 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
    },
  },
  {
    id: "explosion",
    title: "Explosion",
    description: "Burst emission creating an explosion effect.",
    tags: ["burst", "intermediate"],
    config: {
      duration: 2,
      looping: true,
      maxParticles: 150,
      startLifetime: { min: 0.3, max: 1.0 },
      startSpeed: { min: 3, max: 8 },
      startSize: { min: 0.1, max: 0.4 },
      startColor: {
        min: { r: 1.0, g: 0.3, b: 0.0 },
        max: { r: 1.0, g: 1.0, b: 0.3 },
      },
      gravity: 2,
      emission: {
        rateOverTime: 0,
        bursts: [{ time: 0, count: 100 }],
      },
      shape: {
        shape: "SPHERE",
        sphere: { radius: 0.1 },
      },
      renderer: {
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        discardBackgroundColor: false,
        backgroundColorTolerance: 1,
        backgroundColor: { r: 0, g: 0, b: 0 },
      },
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: "BEZIER",
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 0.3, y: 0.8 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: "BEZIER",
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 0.5, y: 0.5 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
    },
  },
  {
    id: "snow",
    title: "Snow",
    description: "Gentle snowfall with slow drift and rotation.",
    tags: ["weather", "beginner"],
    config: {
      duration: 10,
      looping: true,
      maxParticles: 300,
      startLifetime: { min: 3, max: 6 },
      startSpeed: { min: 0.2, max: 0.5 },
      startSize: { min: 0.03, max: 0.1 },
      startRotation: { min: 0, max: 360 },
      startColor: {
        min: { r: 0.9, g: 0.9, b: 1.0 },
        max: { r: 1.0, g: 1.0, b: 1.0 },
      },
      gravity: 0.3,
      emission: { rateOverTime: 40 },
      shape: {
        shape: "BOX",
        box: { scale: { x: 4, y: 0, z: 4 }, emitFrom: "VOLUME" },
      },
      rotationOverLifetime: {
        isActive: true,
        min: -30,
        max: 30,
      },
    },
  },
  {
    id: "sparkle",
    title: "Sparkle Ring",
    description: "Orbital velocity creating a spinning sparkle ring.",
    tags: ["orbital", "advanced"],
    config: {
      duration: 5,
      looping: true,
      maxParticles: 150,
      startLifetime: 2,
      startSpeed: 0,
      startSize: { min: 0.05, max: 0.15 },
      startColor: {
        min: { r: 1.0, g: 0.8, b: 0.2 },
        max: { r: 1.0, g: 1.0, b: 0.6 },
      },
      emission: { rateOverTime: 30 },
      shape: {
        shape: "CIRCLE",
        circle: { radius: 1.5, radiusThickness: 0 },
      },
      renderer: {
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        discardBackgroundColor: false,
        backgroundColorTolerance: 1,
        backgroundColor: { r: 0, g: 0, b: 0 },
      },
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 0, y: 0, z: 0 },
        orbital: { x: 0, y: 90, z: 0 },
      },
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: "BEZIER",
          scale: 1,
          bezierPoints: [
            { x: 0, y: 0, percentage: 0 },
            { x: 0.2, y: 1 },
            { x: 0.8, y: 1 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: "BEZIER",
          scale: 1,
          bezierPoints: [
            { x: 0, y: 0, percentage: 0 },
            { x: 0.1, y: 1 },
            { x: 0.8, y: 1 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
    },
  },
  {
    id: "smoke",
    title: "Smoke",
    description: "Rising smoke with growing size and fading opacity.",
    tags: ["intermediate"],
    config: {
      duration: 5,
      looping: true,
      maxParticles: 100,
      startLifetime: { min: 2, max: 4 },
      startSpeed: { min: 0.5, max: 1.0 },
      startSize: { min: 0.2, max: 0.4 },
      startOpacity: 0.6,
      startColor: {
        min: { r: 0.3, g: 0.3, b: 0.3 },
        max: { r: 0.5, g: 0.5, b: 0.5 },
      },
      gravity: -0.2,
      emission: { rateOverTime: 15 },
      shape: {
        shape: "CONE",
        cone: { angle: 0.1, radius: 0.15 },
      },
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: "BEZIER",
          scale: 3,
          bezierPoints: [
            { x: 0, y: 0.3, percentage: 0 },
            { x: 0.5, y: 0.7 },
            { x: 1, y: 1, percentage: 1 },
          ],
        },
      },
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: "BEZIER",
          scale: 1,
          bezierPoints: [
            { x: 0, y: 0.6, percentage: 0 },
            { x: 0.3, y: 0.5 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
    },
  },
];

// Minimal Three.js setup for each example card
class ExampleCard {
  constructor(container, exampleData) {
    this.container = container;
    this.data = exampleData;
    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    const canvas = this.container.querySelector("canvas");
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 220;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.set(0, 1, 5);
    this.camera.lookAt(0, 0.5, 0);

    // We dynamically import the library to support CDN or local builds
    this.loadParticleSystem();
  }

  async loadParticleSystem() {
    try {
      // Try loading from the built dist (relative path for GitHub Pages)
      const lib = await import(
        "https://cdn.jsdelivr.net/npm/@newkrok/three-particles@2.4.0/dist/index.js"
      );
      const system = lib.createParticleSystem(this.data.config);
      this.scene.add(system.instance);
      this.particleSystem = system;
      this.animate();
    } catch (e) {
      // Fallback: show a placeholder
      console.warn(`Could not load particle system for "${this.data.id}":`, e);
      const canvas = this.container.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#666";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "Load library to see preview",
          canvas.width / 2,
          canvas.height / 2
        );
      }
    }
  }

  animate() {
    if (!this.particleSystem) return;
    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    this.particleSystem.update({
      now: performance.now(),
      delta,
      elapsed,
    });

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.particleSystem) this.particleSystem.dispose();
    if (this.renderer) this.renderer.dispose();
  }
}

// Build the page
const grid = document.getElementById("examples-grid");

examples.forEach((example) => {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <canvas></canvas>
    <div class="card-info">
      <h3>${example.title}</h3>
      <p>${example.description}</p>
      ${example.tags.map((t) => `<span class="tag">${t}</span>`).join(" ")}
    </div>
  `;
  grid.appendChild(card);

  // Initialize with IntersectionObserver for performance
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !card._example) {
          card._example = new ExampleCard(card, example);
          observer.unobserve(card);
        }
      });
    },
    { threshold: 0.1 }
  );
  observer.observe(card);
});
