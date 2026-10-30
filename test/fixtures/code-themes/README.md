# Code theme fixtures

Themes with a `slots/` folder, so the build compiles their components. `vitest.config.ts` adds this folder to `MICELIO_THEME_DIRS` for the `nuxt` project only, so `test/nuxt/ThemeSlotRuntime.test.ts` can pick between two code themes at run time (the starter and `second`). `test/fixtures/themes/` holds data-only themes and is not loaded by the component tests.
