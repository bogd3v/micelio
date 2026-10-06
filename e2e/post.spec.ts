import { test, expect } from '@playwright/test'

test('renders the article with content and TOC', async ({ page }) => {
  await page.goto('/blog/understanding-vue-composables')
  await expect(page.locator('h1')).toHaveText('Understanding Vue Composables')
  await expect(page.locator('.bd-article-author-name')).toHaveText('Alejandro Ramirez')
  await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible()
  await expect(page.locator('a[href="#getting-started"]')).toBeVisible()
})

test('server-renders SEO meta with the article cover as share image', async ({ request }) => {
  const html = await (await request.get('/blog/understanding-vue-composables')).text()
  expect(html).toContain('<title>Vue Composables</title>')
  expect(html).toMatch(/<meta property="og:image" content="[^"]*\/uploads\/cover-vue\.png">/)
  expect(html).toMatch(/<meta name="twitter:image" content="[^"]*\/uploads\/cover-vue\.png">/)
  expect(html).not.toContain('/theme/images/og-image.png')
})

test('renders markdown code as a design system code block that copies without prompts', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  const block = page.locator('figure.bd-code')
  await expect(block.locator('.bd-code-lang')).toHaveText('bash')
  await expect(block.locator('.bd-prompt')).toHaveCount(2)
  const copy = block.getByRole('button', { name: 'Copy code' })
  await expect(copy).toHaveText('Copy')
  await copy.click()
  await expect(block.getByRole('button', { name: 'Copied ✓' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm create nuxt@latest\nnpm run dev')
})

test('emits BlogPosting JSON-LD', async ({ request }) => {
  const html = await (await request.get('/blog/understanding-vue-composables')).text()
  expect(html).toContain('"@type":"BlogPosting"')
})

test('follows the reading with the table of contents', async ({ page }) => {
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  const toc = page.getByRole('navigation', { name: 'In this article' })
  await expect(toc.getByRole('link', { name: 'Getting Started' })).toHaveAttribute('aria-current', 'true')
  await toc.getByRole('link', { name: 'Naming' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#naming$/)
  await expect(toc.getByRole('link', { name: 'Naming' })).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('aside.bd-callout').getByText('Analogy')).toBeVisible()
})

test('copies the article link and announces it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  await page.locator('.bd-article-actions').getByRole('button', { name: 'Copy link' }).click()
  await expect(page.locator('.bd-article-actions [aria-live="polite"]')).toHaveText('Link copied ✓')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/blog/understanding-vue-composables')
})

test('threads replies under their comment and hydrates cleanly', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Hydration')) errors.push(message.text())
  })
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  const thread = page.locator('.bd-comment-thread')
  await expect(thread.getByText('Thanks, glad it helped!')).toBeVisible()
  await expect(page.getByText('Conversation · 2 comments')).toBeVisible()
  expect(errors).toEqual([])
})

test('shows only the comments written in the language being read', async ({ page }) => {
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  const comments = page.locator('#comments')
  await expect(comments.locator('.bd-comment')).toHaveCount(2)
  await expect(comments).not.toContainText('Comentario en la versión en español.')
  await expect(comments.getByRole('group', { name: 'Filter comments' })).toHaveCount(0)
  await expect(comments.getByRole('complementary', { name: 'Moderation' })).toHaveCount(0)
})

test('labels fediverse replies and filters the thread by origin on federated articles', async ({ page }) => {
  await page.goto('/es/blog/guia-vue-composables', { waitUntil: 'networkidle' })
  const comments = page.locator('#comments')
  const reply = comments.locator('.bd-comment-fediverse')
  await expect(reply.locator('.bd-comment-badge-fediverse')).toContainText('@bea@mastodon.social')
  await expect(reply.locator('.bd-comment-instance-link')).toHaveAttribute('href', 'https://mastodon.social/users/bea/statuses/1')
  await expect(comments.getByRole('complementary', { name: 'Moderación' })).toContainText('Las respuestas del fediverso se publican después de revisarlas')

  const filters = comments.getByRole('group', { name: 'Filtrar comentarios' })
  await filters.getByRole('button', { name: 'Del fediverso' }).click()
  await expect(comments.locator('.bd-comment')).toHaveCount(1)
  await filters.getByRole('button', { name: 'Del blog' }).click()
  await expect(comments.locator('.bd-comment')).toHaveCount(1)
  await expect(comments.locator('.bd-comment-fediverse')).toHaveCount(0)
})

test('shows the fediverse activity and reply block on federated articles', async ({ page }) => {
  await page.goto('/es/blog/guia-vue-composables', { waitUntil: 'networkidle' })
  const bar = page.getByRole('region', { name: 'En el fediverso' })
  await expect(bar.locator('.bd-fedi-bar-stats')).toContainText('7 me gusta')
  await expect(bar.locator('.bd-fedi-bar-stats')).toContainText('3 impulsos')
  await expect(bar.locator('.bd-fedi-bar-stats')).toContainText('1 respuesta')
  await bar.getByRole('button', { name: 'Responder desde el fediverso' }).click()
  await expect(bar.locator('.bd-fedi-reply-address')).toHaveText('https://api.bogdev.com.co/fediverse/articles/doc-vue-es')
  await expect(bar).toContainText('Tu respuesta llega como comentario y se publica después de moderarla.')
})

test('leaves the fediverse block out of non-federated articles', async ({ page }) => {
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-fedi-bar')).toHaveCount(0)
})

test('jumps from a citation to its reference and back without hiding under the header', async ({ page }) => {
  await page.goto('/es/blog/guia-vue-composables', { waitUntil: 'networkidle' })
  const cites = page.locator('.bd-prose a.bd-cite')
  await expect(cites).toHaveText(['[1]', '[2]', '[3]', '[1]', '[4]'])
  const references = page.getByRole('region', { name: 'Referencias' })
  await expect(references.locator('li.bd-ref')).toHaveCount(4)
  await expect(references.getByText('4 fuentes · APA 7')).toBeVisible()
  await expect(references.getByText('Consultadas el 11.09.2026.')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'En este artículo' }).getByRole('link', { name: 'Referencias' })).toHaveAttribute('href', '#references')

  await page.getByRole('link', { name: 'Referencia 2', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#ref-2$/)
  const reference = page.locator('#ref-2')
  const headerBottom = await page.locator('header').first().evaluate(header => header.getBoundingClientRect().bottom)
  expect((await reference.boundingBox())!.y).toBeGreaterThanOrEqual(headerBottom)

  await reference.getByRole('link', { name: 'Volver a la cita 2 en el texto' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#cite-2$/)
  expect((await page.locator('#cite-2').boundingBox())!.y).toBeGreaterThanOrEqual(headerBottom)
})

test('leaves articles without references unchanged', async ({ page }) => {
  await page.goto('/blog/understanding-vue-composables')
  await expect(page.locator('h1')).toHaveText('Understanding Vue Composables')
  await expect(page.locator('#references')).toHaveCount(0)
  await expect(page.locator('.bd-cite')).toHaveCount(0)
})

test('numbers figures and credits each image, the slides and the cover', async ({ page }) => {
  await page.goto('/es/blog/guia-vue-composables', { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-article-cover-credit')).toHaveText('Ilustración Alejandro Ramírez · BogDev · obra propia')

  const photo = page.locator('.bd-prose figure.bd-fig').first()
  await expect(photo.locator('.bd-fig-n')).toHaveText('Fig. 01')
  await expect(photo.locator('.bd-credit')).toHaveText('Foto Danielfjio · Wikimedia Commons · CC BY-SA 4.0 · recortada')
  await expect(photo.getByRole('link', { name: 'CC BY-SA 4.0 (se abre en una pestaña nueva)' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/deed.es')

  const slider = page.locator('.bd-prose figure.bd-fig').nth(1)
  const caption = slider.locator('figcaption')
  await expect(caption).toHaveAttribute('aria-live', 'polite')
  await expect(caption.locator('.bd-fig-cap')).toHaveText('Fig. 02 Cada frailejón atrapa el agua de la niebla.')
  await expect(caption.locator('.bd-credit-k')).toHaveText('Ilustración')
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(caption.locator('.bd-fig-cap')).toHaveText('Fig. 02 La misma laguna al amanecer.')
  await expect(caption.locator('.bd-credit-k')).toHaveText('Foto')
})

test('switches to the translated article with its own slug and back', async ({ page }) => {
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click()
  await expect(page).toHaveURL(/\/es\/blog\/guia-vue-composables$/)
  await expect(page.locator('h1')).toHaveText('Guía de Vue Composables')

  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/blog\/understanding-vue-composables$/)
  await expect(page.locator('h1')).toHaveText('Understanding Vue Composables')
})

test('keeps the query and the hash but not the page when switching the article language', async ({ page }) => {
  await page.goto('/es/blog/guia-vue-composables?ref=feed&page=2#primeros-pasos', { waitUntil: 'networkidle' })
  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/blog\/understanding-vue-composables\?/)
  const url = new URL(page.url())
  expect(Object.fromEntries(url.searchParams)).toEqual({ ref: 'feed' })
  expect(url.hash).toBe('#primeros-pasos')
})

test('opens the blog of the other language from an article without translation', async ({ page }) => {
  await page.goto('/blog/linux-server-hardening-guide', { waitUntil: 'networkidle' })
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click()
  await expect(page).toHaveURL(/\/es\/blog$/)
  await expect(page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true')
})

test('server-renders hreflang links to the real URL of each version', async ({ request }) => {
  const hreflangs = async (path: string): Promise<Record<string, string>> => {
    const html = await (await request.get(path)).text()
    const links = [...html.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"[^>]*>|<link[^>]*href="([^"]+)"[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*>/g)]
    return Object.fromEntries(links.map(match => [match[1] ?? match[4], new URL(match[2] ?? match[3]!).pathname]))
  }

  const expected = { 'en': '/blog/understanding-vue-composables', 'es': '/es/blog/guia-vue-composables', 'x-default': '/blog/understanding-vue-composables' }
  expect(await hreflangs('/es/blog/guia-vue-composables')).toEqual(expected)
  expect(await hreflangs('/blog/understanding-vue-composables')).toEqual(expected)
  expect(await hreflangs('/blog/linux-server-hardening-guide')).toEqual({
    'en': '/blog/linux-server-hardening-guide',
    'x-default': '/blog/linux-server-hardening-guide',
  })
  expect(await hreflangs('/es/blog')).toEqual({ 'en': '/blog', 'es': '/es/blog', 'x-default': '/blog' })
})

test('answers 404 with the translated error page for an unknown article', async ({ page }) => {
  const english = await page.goto('/blog/no-existe')
  expect(english?.status()).toBe(404)
  await expect(page.locator('h1')).toHaveText('Page Not Found')
  await expect(page.getByRole('link', { name: 'Browse Blog' })).toHaveAttribute('href', '/blog')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  await expect(page.locator('link[rel="canonical"], link[hreflang]')).toHaveCount(0)

  const spanish = await page.goto('/es/blog/no-existe')
  expect(spanish?.status()).toBe(404)
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(page.locator('h1')).toHaveText('Página No Encontrada')
  await expect(page.getByRole('link', { name: 'Explorar Blog' })).toHaveAttribute('href', '/es/blog')
})

test('answers with a server error, not 404, when Strapi fails', async ({ page }) => {
  const response = await page.goto('/blog/broken-article')
  expect(response?.status()).toBe(502)
  await expect(page.locator('h1')).toHaveText('Something Went Wrong')
})

test('shows the error page when navigating in the client to an unknown article', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    const root = document.querySelector('#__nuxt') as unknown as { __vue_app__: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } } }
    await root.__vue_app__.config.globalProperties.$router.push('/blog/no-existe')
  })
  await expect(page.locator('h1')).toHaveText('Page Not Found')
  await expect(page.getByRole('link', { name: 'Browse Blog' })).toBeVisible()
})
