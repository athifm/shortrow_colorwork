import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],

  // The site lives at athifm.github.io/shortrow_colorwork/, not at the root of
  // the domain, so every built path has to be prefixed with the repository name.
  // Leave this out and the build asks the browser for /assets/... instead of
  // /shortrow_colorwork/assets/..., which GitHub answers with 404s and the page
  // comes up blank — with nothing in the console to say why.
  base: '/shortrow_colorwork/',
})
