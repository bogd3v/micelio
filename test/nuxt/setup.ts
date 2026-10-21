import { beforeEach } from 'vitest'
import { setThemeData } from './themeData'

// The server provides the theme data to every page; the test app has no server, so each test starts with Bogota's.
beforeEach(() => {
  setThemeData()
})
