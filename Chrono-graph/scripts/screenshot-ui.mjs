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

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err))

  console.log('Navigating to http://localhost:5173/ ...')
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 2000))

  // 1. Capture Main HUD with 3D City & Top Authors
  const hudPath = '/Users/adityabanavali/.gemini/antigravity-ide/brain/ce130c4a-66aa-4118-80ca-e0ac4b23faa6/chronograph_hud_main.png'
  await page.screenshot({ path: hudPath, type: 'png' })
  console.log(`Saved HUD screenshot to ${hudPath}`)

  // 2. Open District Side Panel and simulate building hover tooltip
  await page.evaluate(() => {
    const uiStore = (window).__UI_STORE__?.getState()
    if (uiStore) {
      uiStore.setSelectedDistrict({
        id: 'src',
        name: 'src',
        color: '#00f0ff',
        fileCount: 48,
        totalTouches: 182,
        topContributors: [
          { name: 'Ada Lovelace', count: 72 },
          { name: 'Linus Torvalds', count: 48 },
          { name: 'Grace Hopper', count: 32 },
          { name: 'Alan Turing', count: 18 },
        ],
        recentFiles: [
          'src/world/AnimatedCity.tsx',
          'src/world/layout.ts',
          'src/world/VoxelBuildings.tsx',
          'src/ui/HUDOverlay.tsx',
          'src/ui/LandingScreen.tsx',
          'src/ui/DistrictSidePanel.tsx',
          'src/store/timeline.ts',
        ],
        centerX: 12,
        centerZ: -8,
        width: 34,
        depth: 30,
      })

      uiStore.setHoveredBuilding({
        path: 'src/world/AnimatedCity.tsx',
        touches: 24,
        lastAuthor: 'Ada Lovelace',
        districtName: 'src',
        screenX: 420,
        screenY: 340,
      })
    }
  })

  await new Promise((r) => setTimeout(r, 600))
  const panelPath = '/Users/adityabanavali/.gemini/antigravity-ide/brain/ce130c4a-66aa-4118-80ca-e0ac4b23faa6/chronograph_district_panel.png'
  await page.screenshot({ path: panelPath, type: 'png' })
  console.log(`Saved District Panel screenshot to ${panelPath}`)

  // 3. Open Landing Screen with presets and neon background
  await page.evaluate(() => {
    const uiStore = (window).__UI_STORE__?.getState()
    if (uiStore) {
      uiStore.setHoveredBuilding(null)
      uiStore.setSelectedDistrict(null)
      uiStore.setLandingOpen(true)
    }
  })

  await new Promise((r) => setTimeout(r, 800))
  const landingPath = '/Users/adityabanavali/.gemini/antigravity-ide/brain/ce130c4a-66aa-4118-80ca-e0ac4b23faa6/chronograph_landing_screen.png'
  await page.screenshot({ path: landingPath, type: 'png' })
  console.log(`Saved Landing screenshot to ${landingPath}`)

  // 4. Test Loading Screen with 8-bit progress bar & rate limits
  await page.evaluate(() => {
    const uiStore = (window).__UI_STORE__?.getState()
    const repoStore = (window).__REPO_STORE__?.getState()
    if (uiStore && repoStore) {
      uiStore.setLandingOpen(false)
      repoStore.setRateLimit({ limit: 60, remaining: 48, reset: Date.now() + 3200000 })
      // simulate loading state
      ;(window).__REPO_STORE__.setState({
        isLoading: true,
        progressMessage: 'Fetching commit trees from GitHub API (180/300 commits)...',
      })
    }
  })

  await new Promise((r) => setTimeout(r, 800))
  const loadingPath = '/Users/adityabanavali/.gemini/antigravity-ide/brain/ce130c4a-66aa-4118-80ca-e0ac4b23faa6/chronograph_loading_screen.png'
  await page.screenshot({ path: loadingPath, type: 'png' })
  console.log(`Saved Loading screenshot to ${loadingPath}`)

  await browser.close()
}

capture().catch((err) => {
  console.error('UI Capture failed:', err)
  process.exit(1)
})
