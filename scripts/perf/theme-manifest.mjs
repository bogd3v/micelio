import { createJiti } from 'jiti'

/**
 * The manifest of the installed theme with this id, from the copy theme discovery chooses (`modules/theme/themes.ts`), or undefined when none is installed.
 * In an admission run (`MICELIO_ADMISSION=true`) that is the repository's copy, not the core's.
 */
export async function installedManifest(root, id) {
  const { discoverThemes, themeRoots } = await createJiti(import.meta.url).import('../../modules/theme/themes.ts')
  return discoverThemes(themeRoots(root)).find(theme => theme.id === id)?.manifest
}

/** The first family of the manifest's display stack, lower-cased, or undefined without a manifest */
export function displayFamilyOf(manifest) {
  if (!manifest) return undefined
  const stack = manifest.type?.families?.display ?? ''
  return stack.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase()
}
