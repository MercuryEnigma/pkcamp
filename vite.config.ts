/// <reference types="vitest/config" />
import { createReadStream, cpSync, existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Public path (relative to `base`) the pkhex-wasm runtime is served from.
 * `src/services/pkhex/pkhexWasmBackend.ts` derives the same path from
 * `import.meta.env.BASE_URL`, so both sides must agree.
 */
const WASM_PUBLIC_DIR = 'pkhex-wasm/wasm'

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.dat': 'application/octet-stream',
  '.br': 'application/octet-stream',
  '.pdb': 'application/octet-stream',
}

/**
 * Ships pkhex-wasm's `wasm/_framework/**` runtime assets.
 *
 * The package resolves them relative to its own module URL by default, which
 * a bundler breaks: the files are neither JS nor in `publicDir`, so Vite
 * serves nothing in dev and copies nothing on build. This plugin serves them
 * from node_modules in dev and copies them into the build output, both under
 * `<base>/pkhex-wasm/wasm/`.
 */
function pkhexWasmAssets(): Plugin {
  let sourceDir = ''

  return {
    name: 'pkhex-wasm-assets',

    configResolved(config) {
      // resolve() follows the node_modules symlink to the vendored build.
      sourceDir = resolve(config.root, 'node_modules/pkhex-wasm/wasm')
      if (!existsSync(sourceDir)) {
        config.logger.warn(
          `[pkhex-wasm-assets] runtime not found at ${sourceDir} — run \`npm run build:pkhex-wasm\``
        )
      }
    },

    configureServer(server) {
      const prefix = `${server.config.base}${WASM_PUBLIC_DIR}/`
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url || !url.startsWith(prefix)) return next()

        // Strip the prefix and reject traversal before touching the disk.
        const rel = decodeURIComponent(url.slice(prefix.length))
        if (!rel || rel.includes('..')) return next()

        const file = join(sourceDir, rel)
        if (!file.startsWith(sourceDir) || !existsSync(file)) return next()

        res.setHeader(
          'Content-Type',
          MIME[extname(file)] ?? 'application/octet-stream'
        )
        createReadStream(file).pipe(res)
      })
    },

    // Copy on build. `writeBundle` runs after the output directory is written,
    // so nothing here is clobbered by Vite's own emptyOutDir.
    writeBundle() {
      if (!existsSync(sourceDir)) return
      const outDir = resolve(
        this.environment.config.build.outDir,
        WASM_PUBLIC_DIR
      )
      cpSync(sourceDir, outDir, { recursive: true, dereference: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pkhexWasmAssets()],
  base: '/pkcamp/',
  // vitest's default include glob otherwise picks up vendor/pkhex-wasm's own
  // e2e specs (which need @playwright/test, not installed here) alongside
  // our own tests. Scope test discovery to our own source.
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // The real-WASM backend tests boot the .NET runtime and parse real saves;
    // the default 5s timeout is not enough for the one-time bootstrap.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
  // Vite's dependency scanner otherwise globs every *.html in the project
  // (excluding node_modules) as a potential entry point. That picks up
  // every nested wwwroot/index.html under vendor/ and browser harnesses
  // (pkhex-wasm's own spike apps, e2e fixtures, and the vendored
  // PKHeX.Everywhere submodule), several of which reference build output
  // that doesn't exist in this repo and aborts the scan. Pin the real entry
  // explicitly instead of relying on the glob.
  optimizeDeps: {
    entries: ['index.html'],
    // pkhex-wasm's own README asks bundlers to exclude it from pre-bundling;
    // pre-bundling was also trying (and failing) to read a .map file the
    // .NET wasm runtime references but doesn't ship.
    exclude: ['pkhex-wasm'],
  },
})
