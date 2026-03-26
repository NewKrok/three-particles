import * as THREE from "three";
import { examples } from "./examples-data.js";
import { initVersionSwitcher, cdnUrl, getAvailableVersions } from "./version-switcher.js";
import { BenchmarkRunner } from "./benchmark.js";
import { METRICS } from "./benchmark-chart.js";

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
  if (prepared.subEmitters) {
    for (const sub of prepared.subEmitters) {
      if (sub.config?.renderer?.blending) {
        sub.config.renderer.blending = resolveBlending(sub.config.renderer.blending);
      }
      if (sub.textureId) {
        const subTex = loadTexture(sub.textureId);
        if (subTex) sub.config.map = subTex;
        delete sub.textureId;
      }
    }
  }
  return prepared;
}

// ─── Active demo management — only one demo runs at a time ───────────
let activeCard = null;
const cardRendererTypes = new Map();

function getConfigRendererType(example) {
  return example.config?.renderer?.rendererType || "POINTS";
}

function isTrailExample(example) {
  return getConfigRendererType(example) === "TRAIL";
}

class LiveDemo {
  constructor(container, exampleData, rendererType = "POINTS") {
    this.container = container;
    this.data = exampleData;
    this.rendererType = rendererType;
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
    config.renderer = config.renderer || {};
    if (!isTrailExample(this.data)) {
      config.renderer.rendererType = this.rendererType;
    }
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
  const rendererType = cardRendererTypes.get(card) || "POINTS";
  card._liveDemo = new LiveDemo(card, exampleData, rendererType);
  card.classList.add("active");
  activeCard = card;
}

// ─── Expanded demo for fullscreen modal ─────────────────────────────
let expandDemo = null;
let expandExampleData = null;
let expandRendererType = "POINTS";

class ExpandedDemo {
  constructor(canvas, exampleData, rendererType = "POINTS") {
    this.canvas = canvas;
    this.data = exampleData;
    this.rendererType = rendererType;
    this.clock = new THREE.Clock();
    this.frames = 0;
    this.fpsAccum = 0;
    this.tickAccum = 0;
    this.lastFpsUpdate = 0;
    this.init();
  }

  init() {
    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
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
    config.renderer = config.renderer || {};
    if (!isTrailExample(this.data)) {
      config.renderer.rendererType = this.rendererType;
    }
    const system = createParticleSystem(config);
    this.scene.add(system.instance);
    this.particleSystem = system;

    const label = document.getElementById("expand-renderer-label");
    if (label) {
      const actual = isTrailExample(this.data)
        ? "TRAIL"
        : system.instance instanceof THREE.Mesh
          ? "INSTANCED"
          : "POINTS";
      label.textContent = actual;
    }

    this.startTime = performance.now();
    this.animate();
  }

  animate() {
    if (!this.particleSystem) return;
    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();
    const now = performance.now();

    const tickStart = performance.now();

    const cycleData = { now: Date.now(), delta, elapsed };
    if (this.particleSystem.update) {
      this.particleSystem.update(cycleData);
    } else {
      updateParticleSystems(cycleData);
    }

    this.renderer.render(this.scene, this.camera);

    const tickTime = performance.now() - tickStart;

    this.frames++;
    this.fpsAccum += delta;
    this.tickAccum += tickTime;
    if (now - this.lastFpsUpdate > 500) {
      const fps = this.fpsAccum > 0 ? this.frames / this.fpsAccum : 0;
      const avgTick = this.frames > 0 ? this.tickAccum / this.frames : 0;
      const fpsEl = document.getElementById("expand-fps");
      const ftEl = document.getElementById("expand-frametime");
      const elEl = document.getElementById("expand-elapsed");
      if (fpsEl) fpsEl.textContent = `${fps.toFixed(1)} FPS`;
      if (ftEl) ftEl.textContent = `${avgTick.toFixed(2)} ms/tick`;
      if (elEl) elEl.textContent = `${elapsed.toFixed(1)}s`;
      this.frames = 0;
      this.fpsAccum = 0;
      this.tickAccum = 0;
      this.lastFpsUpdate = now;
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  resize() {
    if (!this.renderer) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.particleSystem) this.particleSystem.dispose();
    if (this.renderer) this.renderer.dispose();
  }
}

function closeExpandModal() {
  const overlay = document.getElementById("expand-overlay");
  overlay.classList.remove("open");
  if (expandDemo) {
    expandDemo.dispose();
    expandDemo = null;
  }
  expandExampleData = null;
}

function openExpandModal(exampleData, rendererType) {
  const overlay = document.getElementById("expand-overlay");
  const canvas = document.getElementById("expand-canvas");
  const titleEl = document.getElementById("expand-title");

  closeExpandModal();

  titleEl.textContent = exampleData.title;
  expandExampleData = exampleData;
  expandRendererType = rendererType;

  const toggle = document.getElementById("expand-renderer-toggle");
  if (isTrailExample(exampleData)) {
    toggle.innerHTML = `<span class="trail-badge" title="Trail / Ribbon renderer">TRAIL</span>`;
  } else {
    toggle.innerHTML = `
      <button data-type="POINTS" title="Point sprites (THREE.Points)">POINTS</button>
      <button data-type="INSTANCED" title="GPU instancing (InstancedBufferGeometry)">INSTANCED</button>
    `;
    toggle.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.type === rendererType);
    });
  }

  overlay.classList.add("open");

  requestAnimationFrame(() => {
    expandDemo = new ExpandedDemo(canvas, exampleData, rendererType);
  });
}

// Expand modal event handlers
document.getElementById("expand-close").addEventListener("click", closeExpandModal);
document.getElementById("expand-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("expand-overlay")) closeExpandModal();
});
document.getElementById("expand-renderer-toggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-type]");
  if (!btn || (expandExampleData && isTrailExample(expandExampleData))) return;
  const type = btn.dataset.type;
  const toggle = document.getElementById("expand-renderer-toggle");
  toggle.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  expandRendererType = type;
  if (expandDemo && expandExampleData) {
    expandDemo.dispose();
    const canvas = document.getElementById("expand-canvas");
    expandDemo = new ExpandedDemo(canvas, expandExampleData, type);
  }
});

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
      <div class="card-tags">
        ${example.tags.map((t) => `<span class="tag">${t}</span>`).join(" ")}
      </div>
      <div class="card-controls">
        <div class="card-btns">
          ${isTrailExample(example)
            ? `<div class="renderer-toggle trail-fixed"><span class="trail-badge" title="Trail / Ribbon renderer">TRAIL</span></div>`
            : `<div class="renderer-toggle">
              <button class="active" data-type="POINTS" title="Point sprites (THREE.Points)">PTS</button>
              <button data-type="INSTANCED" title="GPU instancing (InstancedBufferGeometry)">INST</button>
            </div>`
          }
          <button class="icon-btn expand-btn" title="Open fullscreen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
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

  cardRendererTypes.set(card, getConfigRendererType(example));

  if (!isTrailExample(example)) {
    card.querySelector(".renderer-toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      const btn = e.target.closest("button[data-type]");
      if (!btn) return;
      const type = btn.dataset.type;
      card.querySelector(".renderer-toggle").querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      cardRendererTypes.set(card, type);
      if (activeCard === card) {
        stopActiveDemo();
        startDemo(card, example);
      }
    });
  }

  card.querySelector(".expand-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    openExpandModal(example, cardRendererTypes.get(card) || "POINTS");
  });

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

// ─── Benchmark UI ───────────────────────────────────────────────────
(async () => {
  const overlay = document.getElementById("bench-overlay");
  const openBtn = document.getElementById("bench-open-btn");
  const closeBtn = document.getElementById("bench-close");
  const versionsContainer = document.getElementById("bench-versions");
  const runBtn = document.getElementById("bench-run");
  const abortBtn = document.getElementById("bench-abort");
  const statusEl = document.getElementById("bench-status");
  const chartCanvas = document.getElementById("bench-chart");
  const iframeHost = document.getElementById("bench-iframe-host");
  const selectAllBtn = document.getElementById("bench-select-all");
  const selectNoneBtn = document.getElementById("bench-select-none");

  if (!overlay) return;

  let runner = null;

  // Populate version checkboxes
  let versions;
  try {
    versions = await getAvailableVersions();
  } catch {
    versionsContainer.innerHTML = '<span style="color:#666">Could not load versions</span>';
    return;
  }

  versionsContainer.innerHTML = versions
    .map(
      (v, i) =>
        `<label><input type="checkbox" value="${v}"${i < 3 ? " checked" : ""} /><span>${v}${i === 0 ? " (latest)" : ""}</span></label>`
    )
    .join("");

  selectAllBtn.addEventListener("click", () => {
    versionsContainer.querySelectorAll("input").forEach((cb) => (cb.checked = true));
  });
  selectNoneBtn.addEventListener("click", () => {
    versionsContainer.querySelectorAll("input").forEach((cb) => (cb.checked = false));
  });

  // Metric tabs
  const metricTabs = document.getElementById("bench-metric-tabs");
  metricTabs.innerHTML = Object.entries(METRICS)
    .map(
      ([key, m]) =>
        `<button class="bench-metric-tab${key === "fps" ? " active" : ""}" data-metric="${key}">${m.label}</button>`
    )
    .join("");

  metricTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".bench-metric-tab");
    if (!btn) return;
    metricTabs.querySelectorAll(".bench-metric-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (runner) {
      runner.chart.setMetric(btn.dataset.metric);
    }
  });

  // Open / close modal
  openBtn.addEventListener("click", () => {
    stopActiveDemo();
    overlay.classList.add("open");
    if (runner) runner.resizeChart();
  });
  closeBtn.addEventListener("click", () => {
    if (runner && runner.running) runner.abort();
    overlay.classList.remove("open");
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      if (runner && runner.running) runner.abort();
      overlay.classList.remove("open");
    }
  });

  // Run benchmark
  runBtn.addEventListener("click", async () => {
    const selected = [
      ...versionsContainer.querySelectorAll("input:checked"),
    ].map((cb) => cb.value);

    if (selected.length === 0) {
      statusEl.textContent = "Select at least one version.";
      return;
    }

    runner = new BenchmarkRunner({
      chartCanvas,
      statusEl,
      iframeContainer: iframeHost,
    });
    const activeTab = metricTabs.querySelector(".bench-metric-tab.active");
    if (activeTab) runner.chart.setMetric(activeTab.dataset.metric);
    runner.resizeChart();

    runBtn.disabled = true;
    abortBtn.disabled = false;

    if (typeof gtag === "function") {
      gtag("event", "benchmark_start", {
        event_category: "benchmark",
        event_label: selected.join(","),
      });
    }

    await runner.run(selected);

    runBtn.disabled = false;
    abortBtn.disabled = true;
  });

  // Abort
  abortBtn.addEventListener("click", () => {
    if (runner) runner.abort();
    runBtn.disabled = false;
    abortBtn.disabled = true;
  });

  // Resize chart and expand modal on window resize
  window.addEventListener("resize", () => {
    if (runner) runner.resizeChart();
    if (expandDemo) expandDemo.resize();
  });
})();
