/**
 * Benchmark orchestrator.
 * Runs benchmarks sequentially via iframes and feeds results to BenchmarkChart.
 */
import { BenchmarkChart } from "./benchmark-chart.js";

export class BenchmarkRunner {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.chartCanvas
   * @param {HTMLElement} opts.statusEl - element to show current status text
   * @param {HTMLElement} opts.iframeContainer - container to host the hidden iframe
   */
  constructor({ chartCanvas, statusEl, iframeContainer }) {
    this.chart = new BenchmarkChart(chartCanvas);
    this.statusEl = statusEl;
    this.iframeContainer = iframeContainer;
    this.running = false;
    this.aborted = false;
    this._currentIframe = null;
    this._messageHandler = null;
  }

  /**
   * Run benchmarks for the given versions sequentially.
   * @param {string[]} versions
   * @returns {Promise<void>}
   */
  async run(versions) {
    if (this.running) return;
    this.running = true;
    this.aborted = false;
    this.chart.reset();

    this.setStatus(`Starting benchmark for ${versions.length} version(s)...`);

    for (let i = 0; i < versions.length; i++) {
      if (this.aborted) break;
      const version = versions[i];
      this.setStatus(
        `Benchmarking v${version}... (${i + 1}/${versions.length})`
      );
      this.chart.addVersion(version);

      try {
        await this.runSingle(version);
      } catch (e) {
        this.chart.markError(version);
        this.setStatus(`Error on v${version}: ${e.message}`);
      }

      // Small delay between versions for cleanup
      if (i < versions.length - 1 && !this.aborted) {
        await this.delay(200);
      }
    }

    if (!this.aborted) {
      this.setStatus("Benchmark complete!");
    }
    this.running = false;
  }

  /**
   * Run benchmark for a single version via an iframe.
   * @returns {Promise<object>} result data
   */
  runSingle(version) {
    return new Promise((resolve, reject) => {
      // Cleanup any previous iframe
      this.destroyIframe();

      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "width:320px;height:220px;border:none;opacity:0.01;position:absolute;pointer-events:none;";
      iframe.src = `benchmark-worker.html?v=${encodeURIComponent(version)}`;
      this.iframeContainer.appendChild(iframe);
      this._currentIframe = iframe;

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Benchmark timed out"));
      }, 30000);

      const onMessage = (e) => {
        if (e.source !== iframe.contentWindow) return;
        const data = e.data;
        if (!data || !data.type) return;

        switch (data.type) {
          case "progress":
            this.chart.pushProgress(version, data.metrics);
            break;

          case "result":
            this.chart.markDone(version, data.metrics);
            cleanup();
            resolve(data);
            break;

          case "error":
            cleanup();
            reject(new Error(data.error));
            break;
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        this.destroyIframe();
      };

      this._messageHandler = onMessage;
      window.addEventListener("message", onMessage);
    });
  }

  abort() {
    this.aborted = true;
    this.destroyIframe();
    this.setStatus("Benchmark aborted.");
    this.running = false;
  }

  destroyIframe() {
    if (this._messageHandler) {
      window.removeEventListener("message", this._messageHandler);
      this._messageHandler = null;
    }
    if (this._currentIframe) {
      this._currentIframe.remove();
      this._currentIframe = null;
    }
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  resizeChart() {
    this.chart.resize();
  }

  delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
