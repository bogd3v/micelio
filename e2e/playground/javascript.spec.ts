import { test } from '@playwright/test'
import { registerJavascriptTests } from '../fixtures/playgroundJavascript'

// The JavaScript runtime (QuickJS in the Worker) of the playground in the dynamic site, on every browser (playwright.playground.config.ts)
registerJavascriptTests()

test.describe.configure({ timeout: 90_000 })
