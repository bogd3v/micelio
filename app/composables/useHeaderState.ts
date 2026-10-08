import type { ComputedRef, Ref } from 'vue'
import type { NavLink } from '~/interfaces'
import { headerLinks } from '~/helpers/landing'

export interface HeaderStateInput {
  reading: boolean
  progress?: number
}

export interface HeaderState {
  accountsOn: Ref<boolean>
  searchOn: Ref<boolean>
  fediverseOn: Ref<boolean>
  tracking: ComputedRef<boolean>
  mounted: Ref<boolean>
  shortcut: Ref<string>
  links: ComputedRef<NavLink[]>
  hud: ReturnType<typeof useThemeHud>
  percent: ComputedRef<number>
  progressStyle: ComputedRef<Record<string, string>>
}

/** What every header variant reads: modules, reading progress, search shortcut and nav links. */
export function useHeaderState(props: HeaderStateInput): HeaderState {
  const accountsOn = useModule('accounts')
  const searchOn = useModule('search')
  const fediverseOn = useModule('fediverse')

  const tracking = computed<boolean>(() => props.reading && props.progress === undefined)
  const scrolled = useReadingProgress(tracking)
  const mounted = useMounted()
  const shortcut = ref('⌘K')

  const navLinks = useNavLinks()
  const links = computed(() => __STATIC_BUILD__ ? headerLinks(navLinks.value) : navLinks.value)
  const hud = useThemeHud()
  const percent = computed<number>(() =>
    Math.round(Math.min(100, Math.max(0, props.progress ?? scrolled.value))),
  )
  const progressStyle = computed<Record<string, string>>(() => ({ '--bd-read': String(percent.value / 100) }))

  onMounted(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) shortcut.value = 'Ctrl K'
  })

  return { accountsOn, searchOn, fediverseOn, tracking, mounted, shortcut, links, hud, percent, progressStyle }
}
