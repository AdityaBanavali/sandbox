import puppeteer from 'puppeteer-core'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function captureScreenshots() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,900'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 900 })

  await page.goto('http://localhost:5173/?repo=sample', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2200))

  // 1. City Overview Screenshot
  await page.screenshot({ path: path.join(rootDir, 'docs/images/city-overview.png') })

  // 2. Drone Mode Screenshot
  await page.keyboard.press('d')
  await new Promise((r) => setTimeout(r, 1200))
  await page.screenshot({ path: path.join(rootDir, 'docs/images/drone-mode.png') })
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 800))

  // 3. Landing Screen Screenshot
  await page.evaluate(() => {
    window.__UI_STORE__?.getState().setLandingOpen(true)
  })
  await new Promise((r) => setTimeout(r, 800))
  await page.screenshot({ path: path.join(rootDir, 'docs/images/landing-screen.png') })

  await browser.close()
  console.log('Docs screenshots saved.')
}

captureScreenshots().catch(console.error)
