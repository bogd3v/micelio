const MASTODON_SHARE = 'https://s2f.kytta.dev/'

/** The link to the third-party Mastodon share page (`s2f.kytta.dev`), with `title` and `url` as the text to post. */
export function mastodonShareUrl(title: string, url: string): string {
  return `${MASTODON_SHARE}?text=${encodeURIComponent(`${title} ${url}`)}`
}
