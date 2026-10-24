import { resolve } from 'node:path'

/** The client build manifest, as far as `withoutPrefetch` reads it. */
export type ManifestEntries = Record<string, { src?: string, prefetch?: boolean }>

/**
 * Stops the client from prefetching the chunks of the given source files.
 *
 * @remarks
 * Layout variants and slots of other themes are dynamic imports of the components that choose them at runtime, and Nuxt
 * prefetches a page's dynamic imports, so without this every page would download them at idle. A chunk the page rendered
 * still gets its `modulepreload`. `srcDir` is the folder the manifest's `src` paths are relative to; `files` are absolute.
 */
export function withoutPrefetch(manifest: ManifestEntries, srcDir: string, files: ReadonlySet<string>): void {
  for (const entry of Object.values(manifest)) {
    if (entry.src && files.has(resolve(srcDir, entry.src))) entry.prefetch = false
  }
}
