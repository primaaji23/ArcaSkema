<!-- Copilot / AI agent instructions for FossFLOW monorepo -->
# Copilot Instructions — FossFLOW

Purpose: quickly orient an AI coding assistant to this monorepo so it can be productive (dev, build, tests, common patterns).

- **Big picture**: This is a monorepo with two main packages: the UI app (`packages/fossflow-app`) and the core React library (`packages/fossflow-lib`). The root `package.json` uses NPM Workspaces to tie them together. The app is a PWA built with RSBuild (`rsbuild`), the library is built with Webpack + TypeScript and published as `fossflow`.

- **Key files to read first**:
  - [package.json](package.json) — root scripts and workspaces
  - [packages/fossflow-app/package.json](packages/fossflow-app/package.json) — `rsbuild` commands; entry is `packages/fossflow-app/src`
  - [packages/fossflow-lib/package.json](packages/fossflow-lib/package.json) — `webpack` + `tsc` build process
  - [packages/fossflow-lib/webpack.config.js](packages/fossflow-lib/webpack.config.js) and `tsconfig.declaration.json` — how builds and declaration bundles are produced
  - [e2e-tests/README.md](e2e-tests/README.md) and `e2e-tests/run-tests.sh` — Selenium-based E2E setup (Docker + Python)

- **How to run and build (most useful commands)**:
  - Install dependencies (root): `npm install`
  - Start app dev server (uses workspaces): `npm run dev` (or `npm run dev:win` on Windows)
    - Under the hood this runs `rsbuild dev` from `packages/fossflow-app`
  - Watch/build library: `npm run dev:lib` (watch) or `npm run build:lib` (production build)
  - Full monorepo build: `npm run build` (runs library build then app build)
  - Docker compose (development): `npm run docker:run` → `docker compose -f compose.dev.yml up`
  - Build Docker image locally: `npm run docker:build`
  - Publish library to npm (uses workspace scope): `npm run publish:lib`

- **Tests & CI**:
  - Unit tests: `npm test` (runs workspaces tests if present; `packages/fossflow-lib` uses Jest)
  - E2E tests require Docker + Python; see `e2e-tests/README.md` and run `e2e-tests/run-tests.sh`
  - Semantic release is configured via `semantic-release` (root `package.json`) — CI will run `semantic-release` when configured

- **Project-specific patterns and conventions**:
  - RSBuild is used for the app (`rsbuild dev`, `rsbuild build`), not CRA/Vite — patch or prefer `rsbuild` commands when modifying dev server behaviour.
  - Library build flow: `webpack && tsc --project tsconfig.declaration.json && tsc-alias` — `tsc-alias` is important to rewrite path aliases in `dist`.
  - Use NPM workspaces: referencing packages locally will resolve to workspace packages (e.g., the app depends on `fossflow`). When changing the library, run `npm run dev:lib` (watch) and `npm run dev` to see app pick up local changes.
  - Linting and type-checking live in package scripts (`lint` uses `tsc --noEmit` + `eslint`).

- **Common code locations & patterns to change**:
  - UI entry and routing: [packages/fossflow-app/src/index.tsx](packages/fossflow-app/src/index.tsx) and [packages/fossflow-app/src/App.tsx](packages/fossflow-app/src/App.tsx)
  - i18n files: [packages/fossflow-app/src/i18n](packages/fossflow-app/src/i18n) — follows `i18next` conventions
  - Persistence: `StorageManager.tsx` and `usePersistedDiagram.ts` in the app handle local/session storage and server storage fallback
  - Core drawing logic: [packages/fossflow-lib/src] — look here for models, stores (`zustand`), hooks and schema (`zod`) used across the app

- **Integration points & external dependencies**:
  - App depends on `fossflow` (the local library) — changes to the library affect the app immediately when using workspaces/watch
  - `e2e-tests` integrate via Docker and expect the app served on standard ports; check `compose.dev.yml` for service ports and volume mounts
  - Publishing flow expects `npm publish` from `packages/fossflow-lib` and uses `prepublishOnly` to ensure `dist` is built

- **When editing or adding code**:
  - Run unit tests for the package you changed (e.g., run `npm test --workspace=packages/fossflow-lib`)
  - If you change build/alias paths in TypeScript, run `tsc --project tsconfig.declaration.json` + `tsc-alias` as the build expects rewritten paths
  - Keep translations in `packages/fossflow-app/src/i18n/*.json` — adding keys requires adding to all supported locale files if the change is UI-facing

- **Examples**:
  - To develop the library and app together: `npm install` → `npm run dev:lib` (in a terminal) → `npm run dev` (in another terminal)
  - To produce a production bundle for the library (local publish): `npm run build:lib` then `npm run publish:lib`

- **If you need more context**: check the top-level README and the `FOSSFLOW_ENCYCLOPEDIA.md` for architecture rationale and historical notes.

If anything above is unclear or you'd like more examples (CI workflow snippets, common quick-fixes, or preferred PR style for this repo), say which section to expand.
