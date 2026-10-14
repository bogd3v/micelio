/** The shortest context word that counts: a shorter one would block a large share of all passwords. */
const MIN_WORD_LENGTH = 4

interface PasswordContext {
  username?: string
  email?: string
  siteName?: string
}

function words(text: string | undefined, separators: RegExp): string[] {
  const whole = (text ?? '').trim().toLowerCase()
  return [whole, ...whole.split(separators)].filter(word => word.length >= MIN_WORD_LENGTH)
}

/** Lower case with the accents removed, so `Lectóra` and `lectora` are the same word. */
function plain(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Only the letters and digits: `mi.celio-fan` becomes `micelio` plus the rest, so separators do not hide a word. */
function compact(text: string): string {
  return plain(text).replace(/[^\p{L}\p{N}]/gu, '')
}

/**
 * The words a password may not contain, in lower case: the username, the address before the `@` and its parts, and the site name and its words.
 *
 * @remarks
 * Anything shorter than four characters is left out. Parts of the username and of the address are split at dots, underscores, hyphens and plus signs; the site name at anything that is not a letter or a digit.
 */
export function passwordContextWords(context: PasswordContext): string[] {
  const local = (context.email ?? '').split('@')[0]
  return [...new Set([
    ...words(context.username, /[._+-]+/),
    ...words(local, /[._+-]+/),
    ...words(context.siteName, /[^\p{L}\p{N}]+/u),
  ])]
}

/**
 * Whether a password contains one of the context words, ignoring case, accents and separators.
 *
 * @remarks
 * It does not look for look-alike characters (`m1celio`): it is a check that the person did not build the password from what anyone can guess about them.
 */
export function passwordUsesContext(password: string, contextWords: readonly string[]): boolean {
  if (!contextWords.length) return false
  const plainPassword = plain(password)
  const compactPassword = compact(password)
  return contextWords.some(word => plainPassword.includes(plain(word)) || compactPassword.includes(compact(word)))
}
