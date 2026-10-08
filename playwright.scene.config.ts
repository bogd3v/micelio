import { defineConfig, devices } from '@playwright/test'
import { webServers } from './e2e/servers'

// e2e/scene on Chromium, Firefox and WebKit against the production build (`npm run build`): the CSP that lets the island fetch its
// model (ADR 0004) is only sent there. Headless WebGL varies by browser: each test probes WebGL2 and says which path it ran.
process.env.E2E_BUILD = '1'
const mockPort = Number(process.env.SCENE_MOCK_PORT ?? 4334)
const appPort = Number(process.env.SCENE_APP_PORT ?? 3234)

export default defineConfig({
  testDir: 'e2e/scene',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${appPort}`, colorScheme: 'light' },
  projects: [
    // SwiftShader gives headless Chromium a software WebGL2
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: webServers({ mockPort, appPort, siteUrl: `http://127.0.0.1:${appPort}` }),
})
