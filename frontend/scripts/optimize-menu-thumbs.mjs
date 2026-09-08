/**
 * Builds 256px WebP thumbnails for POS menu cards.
 *
 *   npm run images:thumbs
 *
 * Source:  frontend/public/menu-images/*.jpg (and .png / .jpeg / .webp)
 * Output:  frontend/public/menu-images/thumbs/<name>.webp
 *
 * Order and Menu Management cards are ~56–64px on screen. Serving the 2–5 MB
 * originals is what made those pages load photo-by-photo.
 */
import { mkdir, readdir } from 'node:fs/promises'
import { extname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SOURCE_DIR = join(ROOT, 'public', 'menu-images')
const THUMB_DIR = join(SOURCE_DIR, 'thumbs')
const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const SKIP = new Set(['placeholder.jpg'])

const files = (await readdir(SOURCE_DIR)).filter((name) => {
  if (SKIP.has(name.toLowerCase())) return false
  return SOURCE_EXTENSIONS.has(extname(name).toLowerCase())
})

await mkdir(THUMB_DIR, { recursive: true })

let written = 0
for (const name of files) {
  const input = join(SOURCE_DIR, name)
  const output = join(THUMB_DIR, `${basename(name, extname(name))}.webp`)
  await sharp(input)
    .rotate()
    .resize(256, 256, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toFile(output)
  written += 1
  console.log(`wrote  public/menu-images/thumbs/${basename(output)}`)
}

console.log(`\nDone — ${written} thumbnail(s).`)
