/** The shape of a category or tag slug: lowercase letters, digits and hyphens, 1 to 64 characters. Whether the slug exists is a question for the CMS list (ADR 0016, section 7). */
export const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/
