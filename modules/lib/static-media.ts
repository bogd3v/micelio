import { ofetch } from 'ofetch'

/**
 * Downloads a media file for the static build and resolves with its bytes as a `Blob`.
 *
 * @remarks
 * A redirect is not followed: the URL comes from the configured CMS or media origin, and a host that answers with one (a bucket behind signed URLs, say) must be named in the configuration instead (ASVS V15.3.2).
 *
 * @throws `Error` naming the URL when the download fails or the host redirects.
 */
export async function fetchMedia(url: string): Promise<Blob> {
  try {
    return await ofetch<Blob, 'blob'>(url, { responseType: 'blob', timeout: 60_000, redirect: 'error' })
  } catch (error: unknown) {
    const reason = error instanceof Error ? `${error.message}${error.cause instanceof Error ? ` (${error.cause.message})` : ''}` : String(error)
    throw new Error(`Could not download ${url}: ${reason}. A media host that redirects is not followed; point the media origin at the final URL.`, { cause: error })
  }
}
