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
