import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

// The shape review (Draw tab, development only): verdicts, redraws and notes
// are kept in review/review.json, so they survive a restart and can be read
// straight from the project. Only the dev server has this address; the built
// site has no way to write files.
const REVIEW_FILE = join(import.meta.dirname, 'review', 'review.json')

function reviewFile(): Plugin {
  return {
    name: 'shortrow-review-file',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__review', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'GET') {
          res.end(existsSync(REVIEW_FILE) ? readFileSync(REVIEW_FILE, 'utf8') : '{"entries":{}}')
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('{}')
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            // Parsed and written back out, so the file is always whole,
            // readable JSON.
            const review = JSON.parse(body)
            mkdirSync(dirname(REVIEW_FILE), { recursive: true })
            writeFileSync(REVIEW_FILE, JSON.stringify(review, null, 2) + '\n')
            res.end('{"saved":true}')
          } catch {
            res.statusCode = 400
            res.end('{"saved":false}')
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), reviewFile()],

  // The site lives at athifm.github.io/shortrow_colorwork/, not at the root of
  // the domain, so every built path has to be prefixed with the repository name.
  // Leave this out and the build asks the browser for /assets/... instead of
  // /shortrow_colorwork/assets/..., which GitHub answers with 404s and the page
  // comes up blank — with nothing in the console to say why.
  base: '/shortrow_colorwork/',
})
