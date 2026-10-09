/** The regions of the page whose layout variant a theme can choose (ADR 0005). */
export const LAYOUT_REGIONS = ['header', 'home', 'postList', 'article', 'footer'] as const

/** The slots a theme can fill with its own component (ADR 0005, section 4). */
export const SLOT_NAMES = ['ThemeMark', 'ThemeHero', 'ThemeDivider', 'ThemeEmptyState', 'ThemeIllustration', 'ThemeProgressMarker', 'ThemeSupportArt'] as const
