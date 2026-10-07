import { afterEach, describe, expect, it, vi } from 'vitest'
import { warnOnce } from '~/helpers/pages'

describe('warnOnce', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('logs a key once, then again after ten minutes, and each key on its own', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnOnce('en:a:404', 'first')
    warnOnce('en:a:404', 'again')
    warnOnce('en:a:500', 'other status')
    expect(warn).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    warnOnce('en:a:404', 'later')
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('stays bounded under many keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (let index = 0; index < 250; index++) warnOnce(`bounded:${index}`, 'x')
    expect(warn).toHaveBeenCalledTimes(250)
  })
})
