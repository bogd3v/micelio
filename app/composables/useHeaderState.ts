import type { ComputedRef, Ref } from 'vue'

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
  links: ReturnType<typeof useNavLinks>
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

  const links = useNavLinks()
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
