import puppeteer from 'puppeteer-core'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function runTest() {
  console.log('Launching Chrome...')
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  console.log('Opening app...')
  await page.goto('http://localhost:5173/?repo=sample', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2000))

  // 1. Capture landing screen with animated logo
  console.log('Testing Landing Screen with Logo...')
  await page.evaluate(() => {
    window.__UI_STORE__?.getState().setLandingOpen(true)
  })
  await new Promise((r) => setTimeout(r, 800))
  await page.screenshot({ path: path.join(rootDir, 'logo-landing-test.png') })

  // Close landing screen
  await page.evaluate(() => {
    window.__UI_STORE__?.getState().setLandingOpen(false)
  })
  await new Promise((r) => setTimeout(r, 800))

  // 2. Capture Controls Help modal
  console.log('Testing Controls Help modal (pressing H)...')
  await page.keyboard.press('h')
  await new Promise((r) => setTimeout(r, 800))
  await page.screenshot({ path: path.join(rootDir, 'controls-help-test.png') })
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 500))

  // 3. Test Drone Mode toggle and exit
  console.log('Testing Drone Mode enter and Esc exit...')
  await page.keyboard.press('d')
  await new Promise((r) => setTimeout(r, 1200))
  await page.screenshot({ path: path.join(rootDir, 'drone-mode-active-test.png') })

  // Press Escape to exit drone mode
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 1000))
  await page.screenshot({ path: path.join(rootDir, 'drone-mode-exited-test.png') })

  // 4. Capture Logo at 16px, 64px, 512px
  console.log('Testing Logo sizes: 16px, 64px, 512px...')
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { background: #0a0a1a; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; margin: 0; padding: 40px; color: white; font-family: monospace; }
          .row { display: flex; align-items: center; gap: 24px; }
          .card { background: #0f132a; padding: 16px; border: 1px solid #2b305c; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        </style>
      </head>
      <body>
        <div class="row">
          <div class="card">
            <span>16x16 Favicon</span>
            <img src="http://localhost:5173/favicon-16.png" width="16" height="16" style="image-rendering: pixelated;" />
          </div>
          <div class="card">
            <span>32x32 Favicon</span>
            <img src="http://localhost:5173/favicon-32.png" width="32" height="32" style="image-rendering: pixelated;" />
          </div>
          <div class="card">
            <span>64x64 SVG</span>
            <img src="http://localhost:5173/favicon.svg" width="64" height="64" />
          </div>
        </div>
        <div class="card">
          <span>512x512 App Icon</span>
          <img src="http://localhost:5173/icon-512.png" width="256" height="256" />
        </div>
      </body>
    </html>
  `)
  await new Promise((r) => setTimeout(r, 1000))
  await page.screenshot({ path: path.join(rootDir, 'logo-sizes-test.png') })

  await browser.close()
  console.log('All tests completed successfully.')
}

runTest().catch((err) => {
  console.error(err)
  process.exit(1)
})
