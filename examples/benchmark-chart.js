/**
 * Lightweight canvas-based line chart for benchmark results.
 * Supports multiple metrics, draws a line per version, updates in real-time.
 */

const COLORS = [
  "#4fc3f7", // blue
  "#66bb6a", // green
  "#ffa726", // orange
  "#ef5350", // red
  "#ab47bc", // purple
  "#26c6da", // cyan
  "#ffee58", // yellow
  "#ec407a", // pink
  "#8d6e63", // brown
  "#78909c", // grey
];

export const METRICS = {
  fps:           { label: "FPS",              unit: "fps", decimals: 1, higher: true  },
  avgUpdateTime: { label: "Avg Update Time",  unit: "ms",  decimals: 2, higher: false },
  avgRenderTime: { label: "Avg Render Time",  unit: "ms",  decimals: 2, higher: false },
  avgFrameTime:  { label: "Avg Frame Time",   unit: "ms",  decimals: 2, higher: false },
  p95UpdateTime: { label: "P95 Update Time",  unit: "ms",  decimals: 2, higher: false },
  p95FrameTime:  { label: "P95 Frame Time",   unit: "ms",  decimals: 2, higher: false },
};

const PADDING = { top: 30, right: 20, bottom: 40, left: 55 };

export class BenchmarkChart {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio, 2);

    // Each entry: { version, snapshots: metrics[], color, done, error }
    this.series = [];
    this.colorIndex = 0;
    this.activeMetric = "fps";

    this.resize();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 300;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = w;
    this.h = h;
    this.draw();
  }

  setMetric(metricKey) {
    if (METRICS[metricKey]) {
      this.activeMetric = metricKey;
      this.draw();
    }
  }

  addVersion(version) {
    const color = COLORS[this.colorIndex % COLORS.length];
    this.colorIndex++;
    const entry = { version, snapshots: [], color, done: false, error: false };
    this.series.push(entry);
    this.draw();
    return entry;
  }

  pushProgress(version, metrics) {
    const entry = this.series.find((s) => s.version === version);
    if (!entry) return;
    entry.snapshots.push(metrics);
    this.draw();
  }

  markDone(version, metrics) {
    const entry = this.series.find((s) => s.version === version);
    if (!entry) return;
    entry.snapshots.push(metrics);
    entry.done = true;
    this.draw();
  }

  markError(version) {
    const entry = this.series.find((s) => s.version === version);
    if (!entry) return;
    entry.done = true;
    entry.error = true;
    this.draw();
  }

  reset() {
    this.series = [];
    this.colorIndex = 0;
    this.draw();
  }

  draw() {
    const { ctx, w, h, activeMetric } = this;
    const metricInfo = METRICS[activeMetric];
    const plot = {
      x: PADDING.left,
      y: PADDING.top,
      w: w - PADDING.left - PADDING.right,
      h: h - PADDING.top - PADDING.bottom,
    };

    // Clear
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);

    // Extract values for active metric
    let maxVal = 0;
    let maxPoints = 0;
    for (const s of this.series) {
      for (const snap of s.snapshots) {
        const v = snap[activeMetric] ?? 0;
        if (v > maxVal) maxVal = v;
      }
      if (s.snapshots.length > maxPoints) maxPoints = s.snapshots.length;
    }

    // Nice round max
    if (metricInfo.unit === "fps") {
      maxVal = maxVal > 0 ? Math.ceil(maxVal / 10) * 10 : 60;
    } else {
      maxVal = maxVal > 0 ? Math.ceil(maxVal * 10) / 10 : 1;
      // Round up to nice number
      const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
      maxVal = Math.ceil(maxVal / mag) * mag || 1;
    }
    if (maxPoints < 2) maxPoints = 10;

    // Grid lines & Y axis labels
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#666";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const val = (maxVal / yTicks) * i;
      const y = plot.y + plot.h - (i / yTicks) * plot.h;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.w, y);
      ctx.stroke();
      const label = metricInfo.unit === "ms"
        ? val.toFixed(val < 1 ? 2 : 1) + " ms"
        : Math.round(val) + " " + metricInfo.unit;
      ctx.fillText(label, plot.x - 8, y);
    }

    // X axis label
    ctx.fillStyle = "#555";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Measurement progress", plot.x + plot.w / 2, plot.y + plot.h + 10);

    // Title
    ctx.fillStyle = "#999";
    ctx.font = "bold 12px -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const title = metricInfo.label + " over time";
    ctx.fillText(title, plot.x, 8);
    const titleWidth = ctx.measureText(title).width;
    const hint = metricInfo.higher ? "(higher is better)" : "(lower is better)";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.fillStyle = metricInfo.higher ? "#66bb6a" : "#ffa726";
    ctx.fillText(hint, plot.x + titleWidth + 8, 8);

    // Draw lines
    for (const s of this.series) {
      if (s.snapshots.length === 0) continue;

      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();

      for (let i = 0; i < s.snapshots.length; i++) {
        const val = s.snapshots[i][activeMetric] ?? 0;
        const x = plot.x + (i / (maxPoints - 1)) * plot.w;
        const y = plot.y + plot.h - (val / maxVal) * plot.h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Last point dot
      const lastIdx = s.snapshots.length - 1;
      const lastVal = s.snapshots[lastIdx][activeMetric] ?? 0;
      const lx = plot.x + (lastIdx / (maxPoints - 1)) * plot.w;
      const ly = plot.y + plot.h - (lastVal / maxVal) * plot.h;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Legend
    this.drawLegend(plot, metricInfo);
  }

  drawLegend(plot, metricInfo) {
    const { ctx, activeMetric } = this;
    const x0 = plot.x + plot.w - 10;
    let y0 = plot.y + 4;

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = "11px -apple-system, sans-serif";

    for (const s of this.series) {
      const lastSnap = s.snapshots.length > 0
        ? s.snapshots[s.snapshots.length - 1]
        : null;
      const lastVal = lastSnap ? lastSnap[activeMetric] : null;

      let label;
      if (s.error) {
        label = `${s.version} (error)`;
      } else if (lastVal !== null) {
        const formatted = lastVal.toFixed(metricInfo.decimals);
        label = `${s.version} — ${formatted} ${metricInfo.unit}${s.done ? " ✓" : ""}`;
      } else {
        label = s.version;
      }

      // Background pill
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const tw = ctx.measureText(label).width;
      ctx.fillRect(x0 - tw - 20, y0 - 8, tw + 26, 18);

      // Color dot
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x0 - tw - 12, y0, 4, 0, Math.PI * 2);
      ctx.fill();

      // Text
      ctx.fillStyle = s.error ? "#666" : "#ccc";
      ctx.fillText(label, x0, y0);

      y0 += 22;
    }
  }
}
