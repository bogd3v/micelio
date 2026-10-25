import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishedPage } from '../server/utils/weight'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('publishedPage', () => {
  it('asks for the public page with no cookie, grant, session or forwarded client header', async () => {
    const calls: Array<{ path: string, headers: Record<string, string> }> = []
    vi.stubGlobal('$fetch', async (path: string, options: { headers: Record<string, string>, onResponse: (context: { response: Response }) => void }) => {
      calls.push({ path, headers: options.headers })
      options.onResponse({ response: new Response('<html></html>', { status: 200 }) })
      return new TextEncoder().encode('<html></html>').buffer
    })
    const page = await publishedPage('/showcase')
    expect(page).toEqual({ sent: 13, text: '<html></html>' })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.path).toBe('/showcase')
    // Only the headers the measurement itself sets: the caller's cookie and x-forwarded-for have no way in
    expect(Object.keys(calls[0]!.headers).sort()).toEqual(['accept', 'accept-encoding'])
  })

  it('answers null for a page that is not published at its path, and throws for any other failure', async () => {
    const answer = (status: number) => vi.stubGlobal('$fetch', async (_: string, options: { onResponse: (context: { response: Response }) => void }) => {
      options.onResponse({ response: new Response('', { status }) })
      return new ArrayBuffer(0)
    })
    answer(404)
    expect(await publishedPage('/missing')).toBeNull()
    answer(500)
    await expect(publishedPage('/broken')).rejects.toThrow('answered 500')
  })
})
