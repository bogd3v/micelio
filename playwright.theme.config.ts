import { defineConfig } from '@playwright/test'
import type { Project } from '@playwright/test'
import { webServers } from './e2e/servers'
import { DEFAULT_THEME, discoverThemes, selectTheme, themeRoots } from './modules/theme/themes'
import { THEME_STORAGE_KEY } from './modules/theme/init-script.mjs'

// Visual regression and axe for the active theme (NUXT_PUBLIC_THEME at build time), one project per mode × viewport.
// Run against a build made with MICELIO_SPECIMEN=1 and the same theme (docs/theme-testing.md)
const mockPort = Number(process.env.THEME_MOCK_PORT ?? 4311)
const appPort = Number(process.env.THEME_APP_PORT ?? 3211)
const baseURL = `http://127.0.0.1:${appPort}`
const theme = process.env.NUXT_PUBLIC_THEME || DEFAULT_THEME
const { manifest } = selectTheme(discoverThemes(themeRoots(process.cwd())), theme)

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

// The motion projects (e2e/theme/motion/) run on their own; the visual and axe projects skip them
const MOTION = '**/motion/**'

const projects: Project[] = manifest.modes.flatMap(mode => VIEWPORTS.map(viewport => ({
  name: `${mode.id}-${viewport.name}`,
  testIgnore: MOTION,
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

// Firefox has no scroll timelines; the preference removes view transitions. Anchor positioning and popovers cannot be switched off:
// e2e/theme/motion/support.ts removes what it can from the page (docs/theme-testing.md)
const NATIVE_APIS_OFF = { 'dom.viewTransitions.enabled': false, 'dom.viewTransitions.cross-document.enabled': false, 'layout.css.scroll-driven-animations.enabled': false }

const modeStorage = (modeId: string) => ({ cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: THEME_STORAGE_KEY, value: modeId }] }] })

// Per mode, desktop: reduced motion with every API on, and the APIs off (Chromium and Firefox) with motion allowed
const motionProjects: Project[] = manifest.modes.flatMap((mode) => {
  const metadata = { theme, mode: mode.id }
  const use = { colorScheme: mode.scheme, storageState: modeStorage(mode.id), viewport: { width: 1280, height: 800 } }
  return [
    // A page.evaluate hung for the whole timeout twice (#463) and no retry may hide it: keep the trace of a failure, without screenshots (the renderer is the suspect)
    { name: `${mode.id}-reduced`, testMatch: '**/motion/reduced.spec.ts', metadata, use: { ...use, reducedMotion: 'reduce' as const, trace: { mode: 'retain-on-failure' as const, screenshots: false, snapshots: true } } },
    { name: `${mode.id}-apis-off-chromium`, testMatch: '**/motion/apis-off.spec.ts', metadata, use: { ...use, reducedMotion: 'no-preference' as const } },
    { name: `${mode.id}-apis-off-firefox`, testMatch: '**/motion/apis-off.spec.ts', metadata, use: { ...use, browserName: 'firefox' as const, launchOptions: { firefoxUserPrefs: NATIVE_APIS_OFF }, reducedMotion: 'no-preference' as const } },
  ]
})

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
  // Chromium defers the decode of large images while it rasterizes ("checker imaging"): a capture of the 18,000 px specimen can catch
  // the frame before the hero photo is back (docs/theme-testing.md). The Firefox project sets its own launchOptions
  use: { baseURL, reducedMotion: 'reduce', launchOptions: { args: ['--disable-checker-imaging'] } },
  projects: [...projects, ...motionProjects],
  webServer: webServers({ mockPort, appPort }),
})
