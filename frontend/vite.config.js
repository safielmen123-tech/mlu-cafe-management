import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * POS cards use /menu-images/thumbs/*.webp. The camera originals in
 * public/menu-images are 2–5 MB each (~93 MB total) and must not ship in dist.
 */
function omitFullsizeMenuPhotos() {
  return {
    name: 'omit-fullsize-menu-photos',
    async writeBundle(outputOptions) {
      const dir = join(outputOptions.dir, 'menu-images')
      const { readdir } = await import('node:fs/promises')
      let names
      try {
        names = await readdir(dir)
      } catch {
        return
      }
      await Promise.all(
        names
          .filter((name) => name !== 'placeholder.jpg' && /\.(jpe?g|png)$/i.test(name))
          .map((name) => rm(join(dir, name), { force: true })),
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), omitFullsizeMenuPhotos()],
})
