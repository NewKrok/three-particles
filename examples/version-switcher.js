const CDN_BASE =
  "https://cdn.jsdelivr.net/npm/@newkrok/three-particles@";
const BUNDLE_PATH = "/dist/three-particles.min.js";
const NPM_API =
  "https://registry.npmjs.org/@newkrok/three-particles";
const MAX_VERSIONS = 10;
const VERSION_KEY = "three-particles-version";

/**
 * Fetch the last N published 2.x versions from the npm registry.
 * Returns an array sorted newest-first, e.g. ["2.4.0", "2.3.0", ...].
 */
async function fetchVersions() {
  const res = await fetch(NPM_API);
  const data = await res.json();
  const all = Object.keys(data.versions)
    .filter((v) => v.startsWith("2."))
    .sort((a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pb[i] - pa[i];
      }
      return 0;
    });
  return all.slice(0, MAX_VERSIONS);
}

/** Build the CDN URL for a given version. */
export function cdnUrl(version) {
  return `${CDN_BASE}${version}${BUNDLE_PATH}`;
}

/**
 * Return the version to load: URL param > sessionStorage > latest.
 */
export function getSelectedVersion(versions) {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("v");
  if (fromUrl && versions.includes(fromUrl)) return fromUrl;
  const stored = sessionStorage.getItem(VERSION_KEY);
  if (stored && versions.includes(stored)) return stored;
  return versions[0];
}

/**
 * Initialise the version dropdown. Calls `onVersionChange(version)` when the
 * user picks a different version (triggers a page reload so the new module is
 * loaded fresh).
 */
export async function initVersionSwitcher() {
  const select = document.getElementById("version-select");
  if (!select) return null;

  let versions;
  try {
    versions = await fetchVersions();
  } catch {
    select.innerHTML = "<option>unavailable</option>";
    return null;
  }

  const current = getSelectedVersion(versions);

  select.innerHTML = versions
    .map(
      (v) =>
        `<option value="${v}"${v === current ? " selected" : ""}>${v}${v === versions[0] ? " (latest)" : ""}</option>`
    )
    .join("");
  select.disabled = false;

  select.addEventListener("change", () => {
    const v = select.value;
    sessionStorage.setItem(VERSION_KEY, v);
    if (typeof gtag === "function") {
      gtag("event", "version_switch", {
        event_category: "version",
        event_label: v,
      });
    }
    // Reload with the chosen version as a URL parameter so the importmap
    // doesn't need to be dynamic (importmaps are immutable after page load).
    const url = new URL(window.location);
    url.searchParams.set("v", v);
    window.location.assign(url);
  });

  return current;
}
