<script setup lang="ts">
import type { HeaderSection, Locale, Theme } from '~/interfaces'

const props = withDefaults(defineProps<{
  active?: HeaderSection
  reading?: boolean
  progress?: number
  section?: string
  menuOpen?: boolean
}>(), {
  active: undefined,
  reading: false,
  progress: undefined,
  section: undefined,
  menuOpen: false,
})

const emit = defineEmits<{
  search: []
  menu: []
  theme: [theme: Theme]
  lang: [locale: Locale]
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()
const fediverseUser = useFediverseUser()

const tracking = computed<boolean>(() => props.reading && props.progress === undefined)
const scrolled = useReadingProgress(tracking)
const mounted = useMounted()
const shortcut = ref('⌘K')

const links = computed<{ id: HeaderSection, label: string, to: string }[]>(() => [
  { id: 'home', label: t('nav.home'), to: localizePath('/') },
  { id: 'blog', label: t('nav.blog'), to: localizePath('/blog') },
  { id: 'about', label: t('nav.about'), to: localizePath('/about') },
])
const percent = computed<number>(() =>
  Math.round(Math.min(100, Math.max(0, props.progress ?? scrolled.value))),
)
const progressStyle = computed<Record<string, string>>(() => ({ '--bd-read': String(percent.value / 100) }))

onMounted(() => {
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) shortcut.value = 'Ctrl K'
})
</script>

<template>
  <header :class="['bd-header', { 'bd-header-reading': reading, 'bd-header-auto': tracking }]">
    <div class="bd-nav">
      <div class="bd-header-inner">
        <NuxtLink :to="localizePath('/')" class="bd-brand" :aria-label="t('bd.header.home', { site: site.name })">
          <BdLogo :size="30" />
          <span class="bd-brand-word" aria-hidden="true">Bog<span class="bd-brand-dev">Dev</span></span>
        </NuxtLink>
        <nav class="bd-nav-main" :aria-label="t('bd.header.nav')">
          <ul class="bd-nav-links">
            <li v-for="link in links" :key="link.id">
              <NuxtLink
                :to="link.to"
                class="bd-nav-link"
                :aria-current="active === link.id ? 'page' : undefined"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
        <BdLangSwitch class="bd-nav-lang" @change="emit('lang', $event)" />
        <div class="bd-nav-mobile">
          <BdAccountMenu compact />
          <button
            type="button"
            class="bd-iconbtn"
            :aria-label="t('bd.header.search')"
            aria-haspopup="dialog"
            @click="emit('search')"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6" /><path d="M15.5 15.5 L20 20" /></svg>
          </button>
          <button
            type="button"
            class="bd-iconbtn"
            :aria-label="t('bd.header.menu')"
            aria-haspopup="dialog"
            :aria-expanded="menuOpen ? 'true' : 'false'"
            @click="emit('menu')"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M4 7 H20 M4 12 H20 M4 17 H20" /></svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="reading" class="bd-strip">
      <div class="bd-header-inner">
        <nav class="bd-crumbs bd-meta" :aria-label="t('bd.header.breadcrumbs')">
          <NuxtLink :to="localizePath('/')" class="bd-strip-link">{{ t('nav.home') }}</NuxtLink>
          <span aria-hidden="true">/</span>
          <NuxtLink :to="localizePath('/blog')" class="bd-strip-link">{{ t('nav.blog') }}</NuxtLink>
          <template v-if="section && mounted">
            <span aria-hidden="true">/</span>
            <span class="bd-crumbs-current" aria-current="page">{{ section }}</span>
          </template>
        </nav>
        <div class="bd-strip-actions">
          <span class="bd-meta bd-strip-read">{{ t('bd.header.read', { percent }) }}</span>
          <BdThemeSwitch @change="emit('theme', $event)" />
        </div>
      </div>
    </div>
    <div v-else class="bd-strip">
      <div class="bd-header-inner">
        <p class="bd-meta bd-hud">
          <span class="bd-hud-mark" aria-hidden="true">◆</span>
          <span>{{ t('bd.header.hud.city') }}</span>
          <span class="bd-hud-extra">{{ t('bd.header.hud.coords') }}</span>
          <span class="bd-hud-extra">{{ t('bd.header.hud.altitude') }}</span>
        </p>
        <div class="bd-strip-actions">
          <NuxtLink :to="`${localizePath('/')}#fediverso`" class="bd-chip" :aria-label="t('bd.header.fediverse', { handle: fediverseUser })">
            <span class="bd-hud-mark" aria-hidden="true">◆</span> {{ fediverseUser }}
          </NuxtLink>
          <button
            type="button"
            class="bd-chip"
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Meta+K"
            @click="emit('search')"
          >
            {{ t('bd.header.search') }} <kbd class="bd-kbd" aria-hidden="true">{{ shortcut }}</kbd>
          </button>
          <BdThemeSwitch @change="emit('theme', $event)" />
          <BdAccountMenu />
        </div>
      </div>
    </div>

    <div v-if="reading" class="bd-progress" :style="progressStyle" aria-hidden="true">
      <div class="bd-progress-bar" />
      <div class="bd-progress-track">
        <svg class="bd-progress-bird" width="22" height="14" viewBox="0 0 22 14" focusable="false">
          <path class="bd-wing" d="M1 9 Q6 1 11 8 Q16 1 21 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </div>
  </header>
</template>
