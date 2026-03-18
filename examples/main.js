import * as THREE from "three";
import { examples } from "./examples-data.js";
import { initVersionSwitcher, cdnUrl } from "./version-switcher.js";

// ─── Bootstrap: load the particle library from CDN ──────────────────
const version = await initVersionSwitcher() || "2.4.0";

const particleModule = await import(cdnUrl(version));
const { createParticleSystem, updateParticleSystems } = particleModule;

// Texture ID to file mapping
const TEXTURE_MAP = {
  FLAME: "textures/flame.webp",
  CLOUD: "textures/cloud.webp",
  SNOWFLAKE: "textures/snowflake.webp",
  GRADIENT_POINT: "textures/gradient-point.webp",
  VORTEX: "textures/vortex.webp",
  STAR: "textures/star.webp",
  POINT: "textures/point.webp",
  PLUS_TOON: "textures/plus-toon.webp",
  SNOWFLAKE_DETAILED: "textures/snowflake-detailed.webp",
  SQUARE: "textures/square.webp",
  CIRCLE: "textures/circle.webp",
  LEAF_TOON: "textures/leaf-toon.webp",
  SKULL: "textures/skull.webp",
  ROCKS: "textures/rocks.webp",
  STARBURST: "textures/starbust.webp",
  SOFT_SMOKE: "textures/soft-smoke.webp",
  BUBBLES: "textures/bubbles.webp",
  FEATHER: "textures/feather.webp",
};

const textureLoader = new THREE.TextureLoader();
const textureCache = {};

function loadTexture(textureId) {
  if (!textureId || !TEXTURE_MAP[textureId]) return null;
  if (textureCache[textureId]) return textureCache[textureId];
  const tex = textureLoader.load(TEXTURE_MAP[textureId]);
  tex.flipY = false;
  textureCache[textureId] = tex;
  return tex;
}

function resolveBlending(blending) {
  if (typeof blending === "number") return blending;
  if (blending === "THREE.AdditiveBlending") return THREE.AdditiveBlending;
  return THREE.NormalBlending;
}

function prepareConfig(config, textureId) {
  const prepared = JSON.parse(JSON.stringify(config));
  delete prepared._editorData;
  if (prepared.renderer?.blending) {
    prepared.renderer.blending = resolveBlending(prepared.renderer.blending);
  }
  const tex = loadTexture(textureId);
  if (tex) prepared.map = tex;
  return prepared;
}

// ─── Active demo management — only one demo runs at a time ───────────
let activeCard = null;

class LiveDemo {
  constructor(container, exampleData) {
    this.container = container;
    this.data = exampleData;
    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    const canvas = this.container.querySelector("canvas");
    canvas.style.display = "block";
    const img = this.container.querySelector(".preview-img");
    if (img) img.style.display = "none";
    const overlay = this.container.querySelector(".play-overlay");
    if (overlay) overlay.style.display = "none";
    const stopHint = this.container.querySelector(".stop-hint");
    if (stopHint) stopHint.style.display = "flex";

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
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 100);
    this.camera.position.set(0, 0, 15);
    this.camera.lookAt(0, 0, 0);

    const config = prepareConfig(this.data.config, this.data.textureId);
    const system = createParticleSystem(config);
    this.scene.add(system.instance);
    this.particleSystem = system;
    this.animate();
  }

  animate() {
    if (!this.particleSystem) return;
    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    const cycleData = { now: Date.now(), delta, elapsed };
    if (this.particleSystem.update) {
      this.particleSystem.update(cycleData);
    } else {
      updateParticleSystems(cycleData);
    }

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.particleSystem) this.particleSystem.dispose();
    if (this.renderer) {
      this.renderer.dispose();
    }

    const canvas = this.container.querySelector("canvas");
    if (canvas) canvas.style.display = "none";
    const img = this.container.querySelector(".preview-img");
    if (img) img.style.display = "block";
    const overlay = this.container.querySelector(".play-overlay");
    if (overlay) overlay.style.display = "flex";
    const stopHint = this.container.querySelector(".stop-hint");
    if (stopHint) stopHint.style.display = "none";
  }
}

function stopActiveDemo() {
  if (activeCard) {
    activeCard._liveDemo.dispose();
    activeCard._liveDemo = null;
    activeCard.classList.remove("active");
    activeCard = null;
  }
}

function startDemo(card, exampleData) {
  if (activeCard === card) {
    gtag("event", "click", { event_category: "demo", event_label: "stop", demo: exampleData.id });
    stopActiveDemo();
    return;
  }
  stopActiveDemo();
  gtag("event", "click", { event_category: "demo", event_label: "play", demo: exampleData.id });
  card._liveDemo = new LiveDemo(card, exampleData);
  card.classList.add("active");
  activeCard = card;
}

// ─── Build the page ──────────────────────────────────────────────────
const grid = document.getElementById("examples-grid");

examples.forEach((example) => {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-canvas-wrapper">
      <img class="preview-img" src="previews/${example.id}.webp" alt="${example.title} preview" />
      <canvas style="display:none"></canvas>
      <div class="play-overlay">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="23" stroke="rgba(255,255,255,0.8)" stroke-width="2"/>
          <polygon points="19,14 19,34 36,24" fill="rgba(255,255,255,0.9)"/>
        </svg>
      </div>
      <div class="stop-hint" style="display:none">
        <span>Click to stop</span>
      </div>
    </div>
    <div class="card-info">
      <h3>${example.title}</h3>
      <p>${example.description}</p>
      <div class="card-actions">
        <div class="card-tags">
          ${example.tags.map((t) => `<span class="tag">${t}</span>`).join(" ")}
        </div>
        <div class="card-btns">
          <button class="icon-btn copy-btn" title="Copy config to clipboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="icon-btn download-btn" title="Download config JSON">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  grid.appendChild(card);

  card.querySelector(".copy-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    gtag("event", "click", { event_category: "config_action", event_label: "copy", demo: example.id });
    const btn = e.currentTarget;
    const json = JSON.stringify(example.config, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 1500);
    });
  });

  card.querySelector(".download-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    gtag("event", "click", { event_category: "config_action", event_label: "download", demo: example.id });
    const json = JSON.stringify(example.config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${example.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  card.addEventListener("click", () => startDemo(card, example));
});
