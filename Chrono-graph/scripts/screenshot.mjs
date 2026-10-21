import puppeteer from 'puppeteer-core'

async function capture() {
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

  console.log('Navigating to http://localhost:5173/ ...')
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })

  // Wait 1.5s for initial mount
  await new Promise((r) => setTimeout(r, 1500))

  // Click on Ada Lovelace avatar badge to demonstrate territory highlighting
  await page.evaluate(() => {
    const adaBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ada')
    )
    if (adaBtn) adaBtn.click()
  })

  // Wait 1.5s for animation and highlight
  await new Promise((r) => setTimeout(r, 1500))

  const path = '/Users/adityabanavali/.gemini/antigravity-ide/brain/ce130c4a-66aa-4118-80ca-e0ac4b23faa6/chronograph_avatars_highlight.png'
  await page.screenshot({ path, type: 'png' })
  console.log(`Saved screenshot to ${path}`)

  await browser.close()
}

capture().catch((err) => {
  console.error('Capture failed:', err)
  process.exit(1)
})
