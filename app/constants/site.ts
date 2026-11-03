import type { SocialNetwork } from '../interfaces/site'

/** How the footer lists each network. X is left out: its link only feeds twitter:site. */
export const FOOTER_SOCIALS: Readonly<Partial<Record<SocialNetwork, { label: string, abbr: string }>>> = {
  linkedin: { label: 'LinkedIn', abbr: 'in' },
  github: { label: 'GitHub', abbr: 'gh' },
  gitlab: { label: 'GitLab', abbr: 'gl' },
  codeberg: { label: 'Codeberg', abbr: 'cb' },
  mastodon: { label: 'Mastodon', abbr: 'md' },
  bluesky: { label: 'Bluesky', abbr: 'bs' },
  website: { label: 'Website', abbr: 'www' },
}

/** Where a static or landing build writes what it resolved (the theme: id, version, digests), so what is live can be audited. It changes with every build, so hosts revalidate it. */
export const STATIC_AUDIT_PATH = '/_micelio.json'
