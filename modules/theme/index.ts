import { defineNuxtModule } from 'nuxt/kit'
import { setupAssets } from './assets'
import { createContext, setupWatch } from './context'
import { setupCss } from './css'
import { setupData } from './data'
import { setupLayout } from './layout'
import { setupModes } from './modes'
import { setupSlots } from './slots'

// ADR 0005, section 4: themes live in themes/<id>/ and reach the page through generated files.
// No logic here: each concern has its own file.
export default defineNuxtModule({
  meta: { name: 'micelio-theme', configKey: 'micelioTheme' },
  setup(_options, nuxt) {
    const ctx = createContext(nuxt)
    setupData(ctx)
    setupAssets(ctx)
    setupModes(ctx)
    setupSlots(ctx)
    setupLayout(ctx)
    setupCss(ctx)
    setupWatch(ctx)
  },
})
