/** Where Nitro keeps the pages its route rules cache: `cache` storage, group `nitro/routes`. */
const PAGE_CACHE = 'cache:nitro:routes'

/**
 * Drops the pages Nitro cached, after a theme switch: their HTML names the stylesheet, the preloads and the attributes of the theme that was replaced.
 *
 * @remarks
 * The cache key also carries the theme's digest (the `x-micelio-theme` request header, in a rule's `varies`), so a page rendered while the switch
 * was happening is stored under the old digest and is never read again (ADR 0009, section 8).
 *
 * @param storage - Nitro's storage; the app's own by default.
 */
export async function purgePageCache(storage: Pick<ReturnType<typeof useStorage>, 'clear'> = useStorage()): Promise<void> {
  await storage.clear(PAGE_CACHE)
}
