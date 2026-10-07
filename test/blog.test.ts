import { describe, it, expect } from 'vitest'
import { BLOG_PAGE_SIZE, LOG_PAGE_SIZE, blogPageSize, blogLocation, blogPath, blogQuery, groupPostsByMonth, hasActiveFilters, legacyBlogRedirect, paginationItems, parseBlogRoute, parseSort, searchTerm } from '../app/helpers/blog'
import type { PostListItem } from '../app/interfaces/strapi-post'
import { Category } from '../app/interfaces/design'

describe('parseBlogRoute', () => {
  it('reads the filter and the page from the path and the rest from the query', () => {
    expect(parseBlogRoute({ category: 'Linux', page: '3' }, { search: '  vue  ' })).toEqual({
      category: Category.Linux,
      tag: undefined,
      search: 'vue',
      page: 3,
    })
    expect(parseBlogRoute({ tag: 'Vue' }, {}).tag).toBe('Vue')
  })

  it('drops invalid values', () => {
    expect(parseBlogRoute({ category: 'unknown', page: '-2' }, { search: 'vu' })).toEqual({
      category: undefined,
      tag: undefined,
      search: undefined,
      page: 1,
    })
  })

  it('keeps one filter: the category wins over the tag', () => {
    const filters = parseBlogRoute({ category: 'linux', tag: 'vue' }, {})
    expect(filters.category).toBe(Category.Linux)
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
    expect(blogQuery({ category: Category.Ai, tag: 'RAG', search: 'llm', page: 2, sort: 'oldest', content: true })).toEqual({
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
    expect(blogPath({ category: Category.Ai, page: 1 })).toBe('/blog/category/ia')
    expect(blogPath({ category: Category.Ai, page: 3 })).toBe('/blog/category/ia/page/3')
    expect(blogPath({ tag: 'vue', page: 1 })).toBe('/blog/tag/vue')
    expect(blogPath({ tag: 'vue', page: 2 }, '/es/blog')).toBe('/es/blog/tag/vue/page/2')
  })

  it('lets the category win and encodes the tag', () => {
    expect(blogPath({ category: Category.Linux, tag: 'vue', page: 1 })).toBe('/blog/category/linux')
    expect(blogPath({ tag: 'c++ y más', page: 1 })).toBe('/blog/tag/c%2B%2B%20y%20m%C3%A1s')
  })

  it('builds a location with the query that stays', () => {
    expect(blogLocation({ category: Category.Linux, page: 2, search: 'ssh', view: 'log' }, '/es/blog')).toEqual({
      path: '/es/blog/category/linux/page/2',
      query: { search: 'ssh', view: 'log' },
    })
  })
})

describe('legacyBlogRedirect', () => {
  it('moves category, tag and page to the path in both languages', () => {
    expect(legacyBlogRedirect('/blog', '?category=linux')).toBe('/blog/category/linux')
    expect(legacyBlogRedirect('/es/blog', 'category=Linux&page=2')).toBe('/es/blog/category/linux/page/2')
    expect(legacyBlogRedirect('/blog', 'tag=vue')).toBe('/blog/tag/vue')
    expect(legacyBlogRedirect('/blog/', 'page=3')).toBe('/blog/page/3')
  })

  it('keeps sort, view, search and any other parameter', () => {
    expect(legacyBlogRedirect('/blog', 'sort=oldest&category=linux&view=log&search=ssh&utm=x'))
      .toBe('/blog/category/linux?sort=oldest&view=log&search=ssh&utm=x')
  })

  it('lets the category win when both filters are present', () => {
    expect(legacyBlogRedirect('/blog', 'tag=vue&category=software&page=2')).toBe('/blog/category/software/page/2')
  })

  it('falls back to the tag when the category is unknown and drops empty values', () => {
    expect(legacyBlogRedirect('/blog', 'category=nope&tag=vue')).toBe('/blog/tag/vue')
    expect(legacyBlogRedirect('/blog', 'category=nope&page=1')).toBe('/blog')
    expect(legacyBlogRedirect('/blog', 'page=abc&search=x')).toBe('/blog?search=x')
  })

  it('redirects the first page path to the unpaged one', () => {
    expect(legacyBlogRedirect('/blog/page/1', '')).toBe('/blog')
    expect(legacyBlogRedirect('/es/blog/category/ia/page/1', 'sort=oldest')).toBe('/es/blog/category/ia?sort=oldest')
  })

  it('leaves other URLs alone', () => {
    expect(legacyBlogRedirect('/blog', '')).toBeNull()
    expect(legacyBlogRedirect('/blog', 'sort=oldest')).toBeNull()
    expect(legacyBlogRedirect('/blog/some-post', 'page=2')).toBeNull()
    expect(legacyBlogRedirect('/about', 'category=linux')).toBeNull()
    expect(legacyBlogRedirect('/blog/page/2', '')).toBeNull()
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
