import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Writes the built files into the service worker's precache list, and a
// cache name that changes with them, so the site opens offline after the
// first visit and an update replaces the old files.
function precache() {
  let outDir = 'dist'
  let files = []
  return {
    name: 'edt-precache',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    generateBundle(_, bundle) {
      files = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map')).sort()
    },
    closeBundle() {
      const sw = join(outDir, 'sw.js')
      const pages = ['privacy.html', 'terms.html', 'clinic-terms.html', 'security.html', 'accessibility.html']
      const list = [...files, ...pages].map((f) => `./${f}`)
      const version = createHash('sha256').update(list.join('\n')).update(readFileSync(join(outDir, 'index.html'))).digest('hex').slice(0, 10)
      const src = readFileSync(sw, 'utf8')
      const out = src
        .replace(/^const PRECACHE = \[\];$/m, `const PRECACHE = ${JSON.stringify(list)};`)
        .replace(/^const CACHE = "edt-v7-dev";$/m, `const CACHE = "edt-v7-${version}";`)
      if (out === src) throw new Error('sw.js precache lines not found')
      writeFileSync(sw, out)
    },
  }
}

// Served from the custom domain eyedroptracker.com, so the base is "/".
export default defineConfig({
  plugins: [react(), precache()],
  base: '/',
})
