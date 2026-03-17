# THREE Particles - Felújítási és Fejlesztési Terv

## Összefoglaló

A `@newkrok/three-particles` npm csomag átfogó modernizálása, a `@newkrok/nape-js` mintáját követve. A cél: jobb fejlesztői élmény, magasabb minőség, automatizált folyamatok, és az ökoszisztéma bővítése.

---

## 1. fázis — Projekt infrastruktúra és DX (Developer Experience)

### 1.1 `llms.txt` és `llms-full.txt` létrehozása
- A nape-js mintájára LLM-kontextus fájlok a projekt gyökerében
- `llms.txt`: rövid áttekintés (célja, telepítés, fő API, példák)
- `llms-full.txt`: részletes API referencia, típusok, konfigurációs opciók

### 1.2 `ROADMAP.md` létrehozása
- Nyilvános roadmap a tervezett fejlesztésekről
- Kategorizálva: rövid távú / közép távú / hosszú távú
- Közösségi hozzájárulás ösztönzése

### 1.3 CHANGELOG.md bevezetése
- Visszamenőleg a főbb verziókra (2.0 - 2.4)
- Jövőbeni automatikus generálás conventional commits alapján

### 1.4 CONTRIBUTING.md
- Hozzájárulási útmutató a közösség számára

---

## 2. fázis — Build és CI/CD modernizálás

### 2.1 Automatikus npm publish (release-on-tag)
- **Jelenlegi állapot**: `publish-npm.yml` csak manuális release trigger-re fut
- **Cél**: Automatikus publish tag push-ra VAGY GitHub Release létrehozásra
- Verzió bump + changelog generálás automatizálása (pl. `release-please` vagy `semantic-release`)

### 2.2 CI pipeline bővítése — auto deploy
- **Jelenlegi**: Workflow-ok csak `master` branch PR-ekre futnak
- **Cél**: PR-ekre és push-okra is fussanak a tesztek (dev branch-ekre is)
- TypeDoc deploy automatikusan master push-ra (ez már megvan, de ellenőrzendő)
- GitHub Pages deploy az examples oldalhoz (lásd 4. fázis)

### 2.3 Build rendszer áttekintése
- **Jelenlegi**: tsc + webpack (122KB minified bundle, 3 external: three, three-noise, easing-functions)
- **Lehetőség**: tsup-ra váltás (mint nape-js) → ESM + CJS + DTS egy lépésben
- Tree-shaking javítása — jelenleg a teljes easing-functions (9.6KB) belekerül a bundle-be
- Source map generálás a minified bundle-höz

### 2.4 Bundle size monitoring
- A bundle-size-check workflow javítása (jelenleg csak JSON-t generál, nem összehasonlít)
- Bundle méret limit beállítása (pl. `bundlewatch` vagy `size-limit`)

---

## 3. fázis — Kódminőség és tesztelés

### 3.1 Teszt lefedettség növelése
- **Jelenlegi**: 87% statement, 65.5% branch, 83% function
- **Cél**: 90%+ statement, 80%+ branch
- Különösen hiányzó tesztek:
  - `three-particles.ts` 302-339 (shape kalkulációk)
  - `three-particles.ts` 513-564 (world space szimuláció)
  - `three-particles.ts` 979-1002 (texture sheet animáció)
  - `three-particles.ts` 1265-1276 (dispose/cleanup)
  - `three-particles-utils.ts` 346-366 (default texture creation)

### 3.2 Benchmark rendszer bevezetése
- Performance benchmark suite (mint nape-js)
- Particle creation, update loop, nagy particle count tesztek
- CI-ban futtatás regresszió detektálásra

### 3.3 ESLint konfiguráció frissítése
- Flat config formátum (ESLint 9+)
- Strict TypeScript szabályok

---

## 4. fázis — Examples oldal (GitHub Pages)

### 4.1 Interaktív examples oldal létrehozása
- **Inspiráció**: nape-js server + examples minta
- Standalone HTML+JS examples a repo-ban (`examples/` mappa)
- GitHub Pages-re automatikusan deploy-olva
- Példák:
  - **Basic**: Egyszerű particle rendszer
  - **Fire**: Tűz animáció
  - **Smoke**: Füst effekt
  - **Explosion**: Robbanás (burst emission demo)
  - **Rain/Snow**: Időjárási effektek
  - **Trail**: Nyomvonal effekt (rateOverDistance)
  - **Color Over Lifetime**: Színátmenet demo
  - **Interactive**: Egérkövetés / kattintás interakció

### 4.2 Examples build pipeline
- Vite vagy egyszerű statikus HTML
- GitHub Actions workflow az examples deploy-hoz
- Link a README-ből és a TypeDoc-ból

---

## 5. fázis — Web Worker támogatás

### 5.1 Opcionális Web Worker mód
- **Inspiráció**: nape-js `PhysicsWorkerManager` mintája
- `ParticleWorker` class ami off-main-thread futtatja az update logikát
- SharedArrayBuffer használata a pozíció/méret/szín adatokhoz (zero-copy)
- Fallback postMessage-re ha SharedArrayBuffer nem elérhető
- API:
  ```typescript
  // Opcionális worker mód
  const system = createParticleSystem(config, { useWorker: true });
  // vagy
  const worker = new ParticleWorkerManager();
  worker.createSystem(config);
  worker.update(cycleData);
  ```

### 5.2 Worker teljesítmény
- Benchmark: worker vs main thread összehasonlítás
- Dokumentáció: mikor érdemes használni (>1000 particle, több rendszer)

---

## 6. fázis — Új funkciók és API fejlesztések

### 6.1 Particle System pooling / object reuse
- Particle system instance-ok újrafelhasználása (pl. lövedék effektek)
- `reset()` metódus az instance-on

### 6.2 Sub-emitterek
- Particle halálánál vagy ütközésnél új particle rendszer indítása
- `onParticleDeath` callback particle pozícióval

### 6.3 Force field / attractor támogatás
- Vonzó/taszító erőterek definiálása a térben
- Gravitációs pontok, szél effektek

### 6.4 GPU Instancing (opcionális)
- `THREE.InstancedMesh` alapú renderer nagy particle count-hoz
- Jelentős teljesítmény javulás 10.000+ particle felett

### 6.5 Serialization / JSON export-import
- `particleSystemToJSON()` / `particleSystemFromJSON()`
- Kompatibilitás a three-particles-editor kimenetével
- Verzió mező a konfig formátumban

### 6.6 Preset rendszer
- Beépített preset konfigurációk: `Presets.FIRE`, `Presets.SMOKE`, `Presets.SPARKS`, stb.
- Könnyű belépési pont új felhasználóknak

---

## 7. fázis — Dokumentáció javítása

### 7.1 README bővítése
- Részletesebb Getting Started szekció
- Migration guide (v1 → v2)
- Performance tippek
- Troubleshooting szekció
- Badges frissítése (coverage, TypeDoc link, stb.)

### 7.2 TypeDoc javítások
- Példák hozzáadása minden publikus API-hoz
- Category/module szervezés
- Link az examples oldalra

---

## 8. fázis — Package.json és konfigurációs javítások

### 8.1 Package exports bővítése
- Subpath exports ha szükséges (pl. `@newkrok/three-particles/worker`)
- `sideEffects: false` a jobb tree-shaking-hez

### 8.2 Engine és kompatibilitás
- Node.js 20+ minimum (18 EOL közeledik)
- Three.js verziómátrix dokumentálása
- `peerDependenciesMeta` a three opcionálissá tételéhez CDN módban

### 8.3 Függőségek áttekintése
- `three-noise` (1.1.2) — régi, nem karbantartott → saját implementáció vagy modernebb alternatíva?
- `easing-functions` (1.3.0) — kis méretű, de tree-shake-elhető lenne
- `@newkrok/three-utils` — szükség van-e minden utility-re?

---

## Priorizálás és sorrend

| Prioritás | Feladat | Becsült hatás |
|-----------|---------|---------------|
| **P0** | llms.txt + ROADMAP.md | AI és közösségi láthatóság |
| **P0** | CI/CD auto deploy | Fejlesztői hatékonyság |
| **P0** | Examples oldal | Felhasználói onboarding |
| **P1** | Teszt lefedettség növelése | Kódminőség |
| **P1** | Build modernizálás (tsup) | Bundle méret, DX |
| **P1** | Preset rendszer | Könnyű belépés |
| **P2** | Web Worker támogatás | Teljesítmény |
| **P2** | Serialization | Editor kompatibilitás |
| **P2** | Benchmark rendszer | Regresszió detektálás |
| **P3** | Sub-emitterek | Feature |
| **P3** | Force fields | Feature |
| **P3** | GPU Instancing | Haladó teljesítmény |

---

## Megjegyzések

- A nape-js-ből átvehető minták: llms.txt formátum, benchmark setup, CI workflow struktúra, Web Worker architektúra
- Az examples oldal a legfontosabb a felhasználói élmény szempontjából — a CodePen linkek jók, de saját hosted examples jobb
- A Web Worker mód opcionális marad, nem változtatja meg az alap API-t
- Minden fázis önállóan is release-elhető (semver minor/patch)
