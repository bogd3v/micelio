import { beforeEach } from 'vitest'
import en from '../../themes/bogota/i18n/en.json'
import es from '../../themes/bogota/i18n/es.json'
import { compileMessages } from '../../modules/theme/install/messages'
import { setThemeData } from './themeData'

// The server provides the theme's data and messages to every page; the test app has no server, so each test starts with Bogota's.
beforeEach(() => {
  setThemeData()
  const { $i18n } = useNuxtApp()
  // Compiled as the store holds them: the test app, like the build, has no message compiler
  $i18n.mergeLocaleMessage('en', compileMessages(en))
  $i18n.mergeLocaleMessage('es', compileMessages(es))
})
