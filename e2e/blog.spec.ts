import { test, expect } from '@playwright/test'

test('lists posts', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Blog', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Understanding Vue Composables', level: 3 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Linux Server Hardening Guide', level: 3 })).toBeVisible()
  await expect(page.getByText('▲')).toHaveCount(0)
})

test('filters by category from the chips', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  const categories = page.getByRole('group', { name: 'Filter by category' })
  await categories.getByRole('link', { name: /Software/ }).click()
  await expect(page).toHaveURL(/\/blog\/category\/software$/)
  await expect(categories.getByRole('link', { name: /Software/ })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('heading', { name: 'Linux Server Hardening Guide', level: 3 })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Understanding Vue Composables', level: 3 })).toBeVisible()
  await page.getByRole('button', { name: 'Remove filter Software' }).click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(page.getByRole('heading', { name: 'Linux Server Hardening Guide', level: 3 })).toBeVisible()
})

test('filters by tag from the chips built from the real tags', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  const tags = page.getByRole('group', { name: 'Filter by tag' })
  await expect(tags.getByRole('link')).toHaveText(['#DevOps', '#Linux', '#TypeScript', '#Vue'])
  await tags.getByRole('link', { name: '#Linux' }).click()
  await expect(page).toHaveURL(/\/blog\/tag\/linux$/)
  await expect(tags.getByRole('link', { name: '#Linux' })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('heading', { name: 'Understanding Vue Composables', level: 3 })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Linux Server Hardening Guide', level: 3 })).toBeVisible()
  await page.getByRole('button', { name: 'Remove filter #Linux' }).click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(page.getByRole('heading', { name: 'Understanding Vue Composables', level: 3 })).toBeVisible()
})

test('opens the blog filtered by a tag from an article', async ({ page }) => {
  await page.goto('/blog/understanding-vue-composables', { waitUntil: 'networkidle' })
  const tags = page.locator('.bd-article-tags')
  await expect(tags.getByRole('link')).toHaveText(['#Vue', '#TypeScript'])
  await tags.getByRole('link', { name: '#TypeScript' }).click()
  await expect(page).toHaveURL(/\/blog\/tag\/typescript$/)
  await expect(page.getByRole('heading', { name: 'Understanding Vue Composables', level: 3 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Linux Server Hardening Guide', level: 3 })).toHaveCount(0)
})

test('searches titles from three letters and keeps the term in the URL', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  const search = page.getByRole('searchbox', { name: 'Search articles' })
  await search.fill('vu')
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(/\/blog$/)
  await search.fill('vue')
  await expect(page).toHaveURL(/search=vue/)
  await expect(page.getByRole('status').filter({ hasText: '01 result' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Linux Server Hardening Guide', level: 3 })).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('heading', { name: 'Linux Server Hardening Guide', level: 3 })).toBeVisible()
})

test('shows the empty state and clears the filters', async ({ page }) => {
  await page.goto('/blog/category/privacidad', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'No articles found', level: 2 })).toBeVisible()
  await page.locator('.bd-blog-empty').getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(page.getByRole('heading', { name: 'Understanding Vue Composables', level: 3 })).toBeVisible()
})

test('paginates inside a labelled nav', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  const pagination = page.getByRole('navigation', { name: 'Pagination' })
  await expect(pagination.getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
  await expect(pagination).toContainText('Page 01 of 01')
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('resolves the filters from the URL on the server', async ({ page }) => {
    await page.goto('/blog/category/linux?search=linux')
    await expect(page.getByRole('heading', { name: 'Linux Server Hardening Guide', level: 3 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Understanding Vue Composables', level: 3 })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Filter by category' }).getByRole('link', { name: /Linux/ })).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('searchbox', { name: 'Search articles' })).toHaveValue('linux')
  })
})

test('switches to the log view, grouped by month, and keeps it in the URL', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  const views = page.getByRole('group', { name: 'View' })
  await expect(views.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true')
  await views.getByRole('button', { name: 'Log' }).click()
  await expect(page).toHaveURL(/view=log/)
  await expect(views.getByRole('button', { name: 'Log' })).toHaveAttribute('aria-pressed', 'true')

  const february = page.getByRole('region', { name: 'February 2026' })
  await expect(february.getByRole('link', { name: 'Understanding Vue Composables' })).toBeVisible()
  await expect(february.locator('.bd-log-month-count')).toHaveText('01 article')
  await expect(page.getByRole('region', { name: 'January 2026' }).getByRole('link', { name: 'Linux Server Hardening Guide' })).toBeVisible()
  await expect(page.locator('.bd-card')).toHaveCount(0)

  await page.reload({ waitUntil: 'networkidle' })
  await expect(views.getByRole('button', { name: 'Log' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.bd-log-month')).toHaveCount(2)
})

test('keeps the log view while filtering', async ({ page }) => {
  await page.goto('/blog?view=log', { waitUntil: 'networkidle' })
  await page.getByRole('group', { name: 'Filter by category' }).getByRole('link', { name: /Linux/ }).click()
  await expect(page).toHaveURL(/\/blog\/category\/linux\?view=log$/)
  await expect(page.locator('.bd-log-row')).toHaveCount(1)
  await expect(page.locator('.bd-log-row').getByRole('link', { name: 'Linux Server Hardening Guide' })).toBeVisible()
})

test('names the months in Spanish and shows the fediverse counts in the log', async ({ page }) => {
  await page.goto('/es/blog?view=log', { waitUntil: 'networkidle' })
  await expect(page.getByRole('group', { name: 'Vista' }).getByRole('button', { name: 'Bitácora' })).toHaveAttribute('aria-pressed', 'true')
  const month = page.getByRole('region', { name: 'febrero 2026' })
  await expect(month.locator('.bd-log-month-count')).toHaveText('01 artículo')
  await expect(month.locator('.bd-log-stats')).toHaveText(/◆\s+7 me gusta\s+·\s+3 impulsos/)
})

test('sorts the blog from the select and keeps the order in the URL', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  const sort = page.getByLabel('Sort')
  const titles = page.locator('.bd-blog-grid .bd-card-title')
  await expect(sort).toHaveValue('recent')
  await expect(titles).toHaveText(['Understanding Vue Composables', 'Linux Server Hardening Guide'])

  await sort.selectOption('oldest')
  await expect(page).toHaveURL(/sort=oldest/)
  await expect(titles).toHaveText(['Linux Server Hardening Guide', 'Understanding Vue Composables'])

  await sort.selectOption('fediverse')
  await expect(page).toHaveURL(/sort=fediverse/)
  await expect(titles).toHaveText(['Linux Server Hardening Guide', 'Understanding Vue Composables'])

  await page.reload({ waitUntil: 'networkidle' })
  await expect(sort).toHaveValue('fediverse')

  await sort.selectOption('recent')
  await expect(page).toHaveURL(/\/blog$/)
  await expect(titles).toHaveText(['Understanding Vue Composables', 'Linux Server Hardening Guide'])
})

test('labels the sort options in Spanish', async ({ page }) => {
  await page.goto('/es/blog?sort=fediverse', { waitUntil: 'networkidle' })
  const sort = page.getByLabel('Ordenar')
  await expect(sort).toHaveValue('fediverse')
  await expect(sort.locator('option')).toHaveText(['Más recientes', 'Más antiguos', 'Más comentados en el fediverso'])
})

test('searches the article body from the blog and keeps it in the URL', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'networkidle' })
  await page.getByRole('searchbox', { name: 'Search articles' }).fill('ssh')
  await expect(page).toHaveURL(/search=ssh/)
  await expect(page.locator('.bd-card')).toHaveCount(0)

  await page.getByRole('checkbox', { name: 'Also search the content' }).check()
  await expect(page).toHaveURL(/content=1/)
  await expect(page.locator('.bd-blog-hint')).toHaveText('3 letters minimum · searches titles, summaries and content')
  const card = page.locator('.bd-card')
  await expect(card).toHaveCount(1)
  await expect(card.getByRole('link', { name: 'Linux Server Hardening Guide' })).toBeVisible()
  await expect(card.locator('.bd-card-snippet')).toHaveText('Start with SSH key authentication before anything else.')
  await expect(card.locator('.bd-card-snippet mark')).toHaveText('SSH')

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('checkbox', { name: 'Also search the content' })).toBeChecked()
  await expect(page.locator('.bd-card')).toHaveCount(1)
})

test('replaces the category with the tag: one filter per URL', async ({ page }) => {
  await page.goto('/blog/category/software', { waitUntil: 'networkidle' })
  await page.getByRole('group', { name: 'Filter by tag' }).getByRole('link', { name: '#Linux' }).click()
  await expect(page).toHaveURL(/\/blog\/tag\/linux$/)
  const categories = page.getByRole('group', { name: 'Filter by category' })
  await expect(categories.locator('[aria-current]')).toHaveCount(0)
  await categories.getByRole('link', { name: /Software/ }).click()
  await expect(page).toHaveURL(/\/blog\/category\/software$/)
  await expect(page.getByRole('group', { name: 'Filter by tag' }).locator('[aria-current]')).toHaveCount(0)
})

test('serves the filter and page paths in both languages with path canonicals', async ({ page }) => {
  for (const [path, base] of [
    ['/blog/category/linux', '/blog/category/linux'],
    ['/blog/tag/vue', '/blog/tag/vue'],
    ['/blog/page/2', '/blog/page/2'],
    ['/blog/category/linux/page/2', '/blog/category/linux/page/2'],
    ['/blog/tag/vue/page/2', '/blog/tag/vue/page/2'],
    ['/es/blog/category/linux', '/es/blog/category/linux'],
    ['/es/blog/tag/vue/page/2', '/es/blog/tag/vue/page/2'],
    ['/es/blog/page/2', '/es/blog/page/2'],
  ] as const) {
    const response = await page.goto(path, { waitUntil: 'networkidle' })
    expect(response?.status(), path).toBe(200)
    await expect(page.getByRole('heading', { level: 1 }), path).toBeVisible()
    await expect(page.locator('meta[property="og:url"]'), path).toHaveAttribute('content', `https://bogdev.com.co${base}`)
  }
})

test('points hreflang and the language switch at the first page of the filter', async ({ page }) => {
  await page.goto('/es/blog/category/linux/page/2', { waitUntil: 'networkidle' })
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://bogdev.com.co/blog/category/linux')
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute('href', 'https://bogdev.com.co/es/blog/category/linux')
  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/blog\/category\/linux$/)
})

test('answers 404 for an unknown category and for page 0', async ({ page }) => {
  for (const path of ['/blog/category/cooking', '/es/blog/category/cooking', '/blog/page/0']) {
    expect((await page.goto(path))?.status(), path).toBe(404)
  }
})

test.describe('old query URLs', () => {
  const cases: [string, string][] = [
    ['/blog?category=linux', '/blog/category/linux'],
    ['/blog?tag=vue', '/blog/tag/vue'],
    ['/blog?page=2', '/blog/page/2'],
    ['/blog?category=linux&page=2', '/blog/category/linux/page/2'],
    ['/blog?tag=vue&page=3', '/blog/tag/vue/page/3'],
    ['/es/blog?category=linux', '/es/blog/category/linux'],
    ['/es/blog?tag=vue&page=2', '/es/blog/tag/vue/page/2'],
    ['/blog?category=linux&tag=vue', '/blog/category/linux'],
    ['/blog?category=linux&search=ssh&sort=oldest&view=log', '/blog/category/linux?search=ssh&sort=oldest&view=log'],
    ['/blog?page=1', '/blog'],
    ['/blog/category/linux/page/1', '/blog/category/linux'],
  ]
  for (const [from, to] of cases) {
    test(`redirects ${from} with a 301`, async ({ request }) => {
      const response = await request.get(from, { maxRedirects: 0 })
      expect(response.status()).toBe(301)
      expect(response.headers().location).toBe(to)
    })
  }

  test('leaves the unfiltered list alone', async ({ request }) => {
    expect((await request.get('/blog?sort=oldest', { maxRedirects: 0 })).status()).toBe(200)
  })

  test('lands on the filtered list', async ({ page }) => {
    await page.goto('/es/blog?category=linux', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/es\/blog\/category\/linux$/)
  })
})
