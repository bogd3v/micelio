import type { Category } from '~/interfaces'

interface IllustrationCaption {
  name: string
  scientific: string
}

/** The theme's caption for a category's illustration (`theme.illustration.<category>.*`); null when the theme has none. */
export function useIllustrationCaption(): (category: Category) => IllustrationCaption | null {
  const { t, te } = useI18n()

  return function illustrationCaption(category: Category): IllustrationCaption | null {
    const key = `theme.illustration.${category}`
    if (!te(`${key}.name`)) return null
    return { name: t(`${key}.name`), scientific: te(`${key}.scientific`) ? t(`${key}.scientific`) : '' }
  }
}
