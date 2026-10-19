import { describe, it, expect } from 'vitest'
import { BLOG_PAGE_SIZE, LOG_PAGE_SIZE, blogPageSize, blogLocation, blogPath, blogQuery, groupPostsByMonth, hasActiveFilters, isBlogRouteValid, legacyBlogRedirect, localesWithCategory, paginationItems, parseBlogRoute, parseSort, searchTerm } from '../app/helpers/blog'
import type { PostListItem } from '../app/interfaces/strapi-post'

describe('parseBlogRoute', () => {
  it('reads the filter and the page from the path and the rest from the query', () => {
    expect(parseBlogRoute({ category: 'Garden', page: '3' }, { search: '  vue  ' })).toEqual({
      category: 'garden',
      tag: undefined,
      search: 'vue',
      page: 3,
    })
    expect(parseBlogRoute({ tag: 'Vue' }, {}).tag).toBe('Vue')
  })

  it('keeps a category the built-in constants do not know: the page checks the CMS list', () => {
    expect(parseBlogRoute({ category: 'Garden' }, {}).category).toBe('garden')
  })

  it('drops invalid values', () => {
    expect(parseBlogRoute({ category: 'not a slug', page: '-2' }, { search: 'vu' })).toEqual({
      category: undefined,
      tag: undefined,
      search: undefined,
      page: 1,
    })
  })

  it('keeps one filter: the category wins over the tag', () => {
    const filters = parseBlogRoute({ category: 'garden', tag: 'vue' }, {})
    expect(filters.category).toBe('garden')
    expect(filters.tag).toBeUndefined()
  })

  it('takes the first value of repeated params', () => {
    expect(parseBlogRoute({}, { search: ['llm', 'ai'] }).search).toBe('llm')
  })

  it('reads the log view and ignores unknown views', () => {
    expect(parseBlogRoute({}, { view: 'log' }).view).toBe('log')
    expect(parseBlogRoute({}, { view: 'LOG' }).view).toBe('log')
    expect(parseBlogRoute({}, { view: 'grid' }).view).toBeUndefined()
    expect(parseBlogRoute({}, { view: 'timeline' }).view).toBeUndefined()
  })
})

describe('blogQuery', () => {
  it('keeps only search, view, sort and content', () => {
    expect(blogQuery({ page: 1 })).toEqual({})
    expect(blogQuery({ category: 'orchard', tag: 'RAG', search: 'llm', page: 2, sort: 'oldest', content: true })).toEqual({
      search: 'llm',
      sort: 'oldest',
      content: '1',
    })
  })
})

describe('blogPath', () => {
  it('builds the path of each filter and page', () => {
    expect(blogPath({ page: 1 })).toBe('/blog')
    expect(blogPath({ page: 2 })).toBe('/blog/page/2')
    expect(blogPath({ category: 'orchard', page: 1 })).toBe('/blog/category/orchard')
    expect(blogPath({ category: 'orchard', page: 3 })).toBe('/blog/category/orchard/page/3')
    expect(blogPath({ tag: 'vue', page: 1 })).toBe('/blog/tag/vue')
    expect(blogPath({ tag: 'vue', page: 2 }, '/es/blog')).toBe('/es/blog/tag/vue/page/2')
  })

  it('lets the category win and encodes the tag', () => {
    expect(blogPath({ category: 'garden', tag: 'vue', page: 1 })).toBe('/blog/category/garden')
    expect(blogPath({ tag: 'c++ y más', page: 1 })).toBe('/blog/tag/c%2B%2B%20y%20m%C3%A1s')
  })

  it('builds a location with the query that stays', () => {
    expect(blogLocation({ category: 'garden', page: 2, search: 'ssh', view: 'log' }, '/es/blog')).toEqual({
      path: '/es/blog/category/garden/page/2',
      query: { search: 'ssh', view: 'log' },
    })
  })
})

describe('isBlogRouteValid', () => {
  it('accepts a category of any slug shape and a page above the first', () => {
    expect(isBlogRouteValid({})).toBe(true)
    expect(isBlogRouteValid({ category: 'Garden', page: '2' })).toBe(true)
    expect(isBlogRouteValid({ category: 'garden' })).toBe(true)
    expect(isBlogRouteValid({ tag: 'anything', page: '10' })).toBe(true)
  })

  it('rejects a category that is not a slug and pages 0 and 1', () => {
    expect(isBlogRouteValid({ category: 'not a slug' })).toBe(false)
    expect(isBlogRouteValid({ category: 'a'.repeat(65) })).toBe(false)
    expect(isBlogRouteValid({ page: '0' })).toBe(false)
    expect(isBlogRouteValid({ page: '1' })).toBe(false)
  })
})

// The CMS list of the site: only these slugs are categories, anything else in the query is a tag
const KNOWN = new Set(['garden', 'kitchen', 'orchard'])

function redirect(pathname: string, search: string): string | null {
  return legacyBlogRedirect(pathname, search, slug => KNOWN.has(slug))
}

describe('legacyBlogRedirect', () => {
  it('moves category, tag and page to the path in both languages', () => {
    expect(redirect('/blog', '?category=garden')).toBe('/blog/category/garden')
    expect(redirect('/es/blog', 'category=Garden&page=2')).toBe('/es/blog/category/garden/page/2')
    expect(redirect('/blog', 'tag=vue')).toBe('/blog/tag/vue')
    expect(redirect('/blog/', 'page=3')).toBe('/blog/page/3')
  })

  it('keeps sort, view, search and any other parameter', () => {
    expect(redirect('/blog', 'sort=oldest&category=garden&view=log&search=ssh&utm=x'))
      .toBe('/blog/category/garden?sort=oldest&view=log&search=ssh&utm=x')
  })

  it('lets the category win when both filters are present', () => {
    expect(redirect('/blog', 'tag=vue&category=kitchen&page=2')).toBe('/blog/category/kitchen/page/2')
  })

  it('falls back to the tag when the category is unknown and drops empty values', () => {
    expect(redirect('/blog', 'category=nope&tag=vue')).toBe('/blog/tag/vue')
    expect(redirect('/blog', 'category=nope&page=1')).toBe('/blog')
    expect(redirect('/blog', 'page=abc&search=x')).toBe('/blog?search=x')
  })

  it('redirects the first page path to the unpaged one', () => {
    expect(redirect('/blog/page/1', '')).toBe('/blog')
    expect(redirect('/es/blog/category/orchard/page/1', 'sort=oldest')).toBe('/es/blog/category/orchard?sort=oldest')
  })

  it('lowercases the category and unpads the page', () => {
    expect(redirect('/blog/category/Garden', '')).toBe('/blog/category/garden')
    expect(redirect('/es/blog/category/Garden/page/02', 'view=log')).toBe('/es/blog/category/garden/page/2?view=log')
    expect(redirect('/blog/page/02', '')).toBe('/blog/page/2')
    expect(redirect('/blog/tag/vue/page/002', '')).toBe('/blog/tag/vue/page/2')
  })

  it('leaves a tag that is named like a category alone and keeps the 404 cases out', () => {
    expect(redirect('/blog/tag/garden', '')).toBeNull()
    expect(redirect('/blog/category/cooking', '')).toBeNull()
    expect(redirect('/blog/page/0', '')).toBeNull()
  })

  it('leaves a tag with an encoded character alone, whether the path arrives encoded or decoded', () => {
    for (const path of ['/blog/tag/a%20b', '/blog/tag/a b', '/blog/tag/caf%C3%A9', '/blog/tag/café', '/blog/tag/caf%c3%a9', '/es/blog/tag/a%20b/page/2', '/blog/tag/a%2Fb']) {
      expect(redirect(path, ''), path).toBeNull()
    }
  })

  it('leaves a tag with a malformed escape to the route instead of redirecting', () => {
    expect(redirect('/blog/tag/%E0%A4%A', '')).toBeNull()
  })

  it('leaves other URLs alone', () => {
    expect(redirect('/blog', '')).toBeNull()
    expect(redirect('/blog', 'sort=oldest')).toBeNull()
    expect(redirect('/blog/some-post', 'page=2')).toBeNull()
    expect(redirect('/about', 'category=garden')).toBeNull()
    expect(redirect('/blog/page/2', '')).toBeNull()
    expect(redirect('/blog/category/garden/page/2', 'sort=oldest')).toBeNull()
    expect(redirect('/fr/blog', 'category=garden')).toBeNull()
  })
})

describe('blog views', () => {
  it('keeps the log view in the URL and leaves the grid as default', () => {
    expect(blogQuery({ page: 1, view: 'log' })).toEqual({ view: 'log' })
    expect(blogQuery({ page: 2, view: 'grid' })).toEqual({})
  })

  it('does not count the view as a filter', () => {
    expect(hasActiveFilters({ page: 1, view: 'log' })).toBe(false)
  })

  it('shows more posts per page in the log', () => {
    expect(blogPageSize('log')).toBe(LOG_PAGE_SIZE)
    expect(blogPageSize('grid')).toBe(BLOG_PAGE_SIZE)
    expect(blogPageSize(undefined)).toBe(BLOG_PAGE_SIZE)
  })
})

describe('blog sort', () => {
  it('reads the sort from the URL and falls back to recent', () => {
    expect(parseBlogRoute({}, { sort: 'oldest' }).sort).toBe('oldest')
    expect(parseBlogRoute({}, { sort: 'Fediverse' }).sort).toBe('fediverse')
    expect(parseBlogRoute({}, { sort: 'recent' }).sort).toBeUndefined()
    expect(parseBlogRoute({}, { sort: 'popular' }).sort).toBeUndefined()
    expect(parseSort(undefined)).toBeUndefined()
    expect(parseSort(['oldest'])).toBeUndefined()
  })

  it('keeps only non-default sorts in the URL', () => {
    expect(blogQuery({ page: 1, sort: 'oldest' })).toEqual({ sort: 'oldest' })
    expect(blogQuery({ page: 1, sort: 'fediverse', view: 'log' })).toEqual({ sort: 'fediverse', view: 'log' })
    expect(blogQuery({ page: 1, sort: 'recent' })).toEqual({})
  })

  it('does not count the sort as a filter', () => {
    expect(hasActiveFilters({ page: 1, sort: 'fediverse' })).toBe(false)
  })
})

describe('content search flag', () => {
  it('reads and writes content=1', () => {
    expect(parseBlogRoute({}, { content: '1' }).content).toBe(true)
    expect(parseBlogRoute({}, { content: '0' }).content).toBeUndefined()
    expect(blogQuery({ page: 1, search: 'rag', content: true })).toEqual({ search: 'rag', content: '1' })
    expect(hasActiveFilters({ page: 1, content: true })).toBe(false)
  })
})

describe('groupPostsByMonth', () => {
  function post(id: number, publishedAt: string | null): PostListItem {
    return { id, title: `Post ${id}`, slug: `post-${id}`, publishedAt }
  }

  const posts = [
    post(1, '2026-10-01T03:00:00.000Z'),
    post(2, '2026-09-12T10:00:00.000Z'),
    post(3, '2026-08-20T10:00:00.000Z'),
    post(4, null),
  ]

  it('groups posts by month in Bogotá time, keeping their order', () => {
    const months = groupPostsByMonth(posts, 'en')
    expect(months.map(month => month.key)).toEqual(['2026-09', '2026-08'])
    expect(months[0]!.posts.map(item => item.id)).toEqual([1, 2])
    expect(months[1]!.posts.map(item => item.id)).toEqual([3])
  })

  it('names the months in the active language', () => {
    expect(groupPostsByMonth(posts, 'en').map(month => month.label)).toEqual(['September 2026', 'August 2026'])
    expect(groupPostsByMonth(posts, 'es').map(month => month.label)).toEqual(['septiembre 2026', 'agosto 2026'])
  })
})

describe('searchTerm', () => {
  it('needs at least three letters', () => {
    expect(searchTerm(' vu ')).toBeUndefined()
    expect(searchTerm(' vue ')).toBe('vue')
  })
})

describe('hasActiveFilters', () => {
  it('ignores the page number', () => {
    expect(hasActiveFilters({ page: 4 })).toBe(false)
    expect(hasActiveFilters({ tag: 'Vue', page: 1 })).toBe(true)
  })
})

describe('paginationItems', () => {
  it('lists every page up to seven', () => {
    expect(paginationItems(1, 1)).toEqual([1])
    expect(paginationItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('collapses distant pages into gaps', () => {
    expect(paginationItems(1, 10)).toEqual([1, 2, 'gap', 10])
    expect(paginationItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
    expect(paginationItems(10, 10)).toEqual([1, 'gap', 9, 10])
  })
})

describe('localesWithCategory', () => {
  const lists = { en: [{ slug: 'garden' }], es: [{ slug: 'garden' }, { slug: 'invierno' }] }

  it('keeps every locale for a page with no category', () => {
    expect(localesWithCategory(undefined, lists)).toEqual(['en', 'es'])
  })

  it('drops the locale whose list does not have the category', () => {
    expect(localesWithCategory('invierno', lists)).toEqual(['es'])
    expect(localesWithCategory('garden', lists)).toEqual(['en', 'es'])
  })

  it('keeps a locale whose list is empty or not loaded', () => {
    expect(localesWithCategory('invierno', { en: [], es: lists.es })).toEqual(['en', 'es'])
    expect(localesWithCategory('invierno', { es: lists.es })).toEqual(['en', 'es'])
  })
})
