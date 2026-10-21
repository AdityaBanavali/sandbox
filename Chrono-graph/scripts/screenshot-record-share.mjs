import puppeteer from 'puppeteer-core'

async function testShareAndRecord() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=metal',
      '--window-size=1600,1000',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000 })

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err))

  console.log('1. Testing default load...')
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 2000))

  // 1. Test Share Modal
  console.log('2. Opening Share Modal...')
  await page.evaluate(() => {
    const uiStore = (window).__UI_STORE__?.getState()
    if (uiStore) uiStore.setShareModalOpen(true)
  })
  await new Promise((r) => setTimeout(r, 500))
  const sharePath = '/Users/adityabanavali/.gemini/antigravity-ide/brain/ce130c4a-66aa-4118-80ca-e0ac4b23faa6/chronograph_share_modal.png'
  await page.screenshot({ path: sharePath, type: 'png' })
  console.log(`Saved Share Modal screenshot to ${sharePath}`)

  // 2. Test Record Modal
  console.log('3. Opening Record Modal...')
  await page.evaluate(() => {
    const uiStore = (window).__UI_STORE__?.getState()
    if (uiStore) {
      uiStore.setShareModalOpen(false)
      uiStore.setRecordModalOpen(true)
    }
  })
  await new Promise((r) => setTimeout(r, 500))
  const recordPath = '/Users/adityabanavali/.gemini/antigravity-ide/brain/ce130c4a-66aa-4118-80ca-e0ac4b23faa6/chronograph_record_modal.png'
  await page.screenshot({ path: recordPath, type: 'png' })
  console.log(`Saved Record Modal screenshot to ${recordPath}`)

  // 3. Test Cinematic Drone Mode (hides UI, auto-orbits, bottom caption banner)
  console.log('4. Activating Cinematic Mode...')
  await page.evaluate(() => {
    const uiStore = (window).__UI_STORE__?.getState()
    if (uiStore) {
      uiStore.setRecordModalOpen(false)
      uiStore.setCinematicMode(true)
    }
  })
  await new Promise((r) => setTimeout(r, 1200))
  const cinematicPath = '/Users/adityabanavali/.gemini/antigravity-ide/brain/ce130c4a-66aa-4118-80ca-e0ac4b23faa6/chronograph_cinematic_mode.png'
  await page.screenshot({ path: cinematicPath, type: 'png' })
  console.log(`Saved Cinematic Mode screenshot to ${cinematicPath}`)

  // 4. Test Shareable URL routing (?repo=redis&t=0.5)
  console.log('5. Testing Shareable URL load (?repo=redis&t=0.5)...')
  await page.goto('http://localhost:5173/?repo=redis&t=0.5', { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 2500))
  const urlLoadPath = '/Users/adityabanavali/.gemini/antigravity-ide/brain/ce130c4a-66aa-4118-80ca-e0ac4b23faa6/chronograph_shareable_url_load.png'
  await page.screenshot({ path: urlLoadPath, type: 'png' })
  console.log(`Saved Shareable URL Load screenshot to ${urlLoadPath}`)

  await browser.close()
}

testShareAndRecord().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
