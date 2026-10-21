import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const svgPath = path.join(rootDir, 'public', 'favicon.svg')
const svgBuffer = fs.readFileSync(svgPath)

async function generateIcons() {
  console.log('Generating favicon icons...')

  // favicon-32.png
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(rootDir, 'public', 'favicon-32.png'))

  // favicon-16.png
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile(path.join(rootDir, 'public', 'favicon-16.png'))

  // apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(rootDir, 'public', 'apple-touch-icon.png'))

  // icon-512.png (512x512)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(rootDir, 'public', 'icon-512.png'))

  // icon-192.png (192x192 for manifest)
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(rootDir, 'public', 'icon-192.png'))

  console.log('All icons generated successfully.')
}

generateIcons().catch((err) => {
  console.error(err)
  process.exit(1)
})
