import { defineConfig } from '@playwright/test'
import type { Project } from '@playwright/test'
import { webServers } from './e2e/servers'
import { DEFAULT_THEME, discoverThemes, selectTheme, themeRoots } from './modules/theme/themes'
import { THEME_STORAGE_KEY } from './modules/theme/init-script.mjs'

// Visual regression and axe for the active theme (NUXT_PUBLIC_THEME at build time), one project per mode × viewport.
// Run against a build made with MICELIO_SPECIMEN=1 and the same theme (docs/theme-testing.md)
const baseURL = 'http://127.0.0.1:3211'
const theme = process.env.NUXT_PUBLIC_THEME || DEFAULT_THEME
const { manifest } = selectTheme(discoverThemes(themeRoots(process.cwd())), theme)

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

const projects: Project[] = manifest.modes.flatMap(mode => VIEWPORTS.map(viewport => ({
  name: `${mode.id}-${viewport.name}`,
  metadata: { theme, mode: mode.id, viewport: viewport.name },
  // First visit lands in the mode: the init script reads it before the first paint
  use: {
    colorScheme: mode.scheme,
    viewport: { width: viewport.width, height: viewport.height },
    ...(viewport.name === 'mobile' ? { isMobile: true, hasTouch: true } : {}),
    storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: THEME_STORAGE_KEY, value: mode.id }] }] },
  },
  // Committed baselines: e2e/theme/__screenshots__/<theme>/<mode>/<viewport>/<name>.png
  snapshotPathTemplate: `e2e/theme/__screenshots__/${theme}/${mode.id}/${viewport.name}/{arg}{ext}`,
})))

export default defineConfig({
  testDir: 'e2e/theme',
  outputDir: 'test-results-theme',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    // 0.1% of the pixels: the same Docker image rasterizes text identically; this only absorbs sub-pixel noise between CPUs
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixelRatio: 0.001 },
  },
  // A missing baseline fails (also in CI): create them with npm run test:theme:update
  updateSnapshots: 'none',
  fullyParallel: true,
  workers: process.env.E2E_BUILD ? '100%' : undefined,
  // A retry would hide a nondeterministic page: a screenshot that needs one is a bug
  retries: 0,
  reporter: [...(process.env.CI ? [['github'] as const] : []), ['html', { outputFolder: 'playwright-report-theme', open: 'never' }]],
  use: { baseURL, reducedMotion: 'reduce' },
  projects,
  webServer: webServers({ mockPort: 4311, appPort: 3211 }),
})
