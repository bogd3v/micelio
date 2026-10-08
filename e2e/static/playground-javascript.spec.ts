import { test } from '@playwright/test'
import { registerJavascriptTests } from '../fixtures/playgroundJavascript'

// The JavaScript runtime (QuickJS in the Worker) of the playground in a static build; `STATIC_BROWSERS=chromium,firefox,webkit` runs it on every browser
registerJavascriptTests()

test.describe.configure({ timeout: 90_000 })
