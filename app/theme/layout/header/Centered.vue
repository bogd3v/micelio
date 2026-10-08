<script setup lang="ts">
import type { HeaderSection, Locale, ThemeMode } from '~/interfaces'

defineOptions({ name: 'RegionHeaderCentered' })

const props = withDefaults(defineProps<{
  active?: HeaderSection
  reading?: boolean
  progress?: number
  section?: string
  menuOpen?: boolean
  label?: string
}>(), {
  active: undefined,
  reading: false,
  progress: undefined,
  section: undefined,
  menuOpen: false,
  label: undefined,
})

const emit = defineEmits<{
  search: []
  menu: []
  theme: [theme: ThemeMode]
  lang: [locale: Locale]
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()
const fediverseUser = useFediverseUser()
const { isStatic } = useStaticSite()
const { accountsOn, searchOn, fediverseOn, tracking, mounted, shortcut, links, hud, percent, progressStyle } = useHeaderState(props)
</script>

<template>
  <header data-layout="centered" :class="['bd-header', { 'bd-header-reading': reading, 'bd-header-auto': tracking }]">
    <div class="bd-nav">
      <div class="bd-header-inner">
        <NuxtLink :to="localizePath('/')" class="bd-brand" :aria-label="t('bd.header.home', { site: site.name })">
          <ThemeMark :size="30" context="header" />
        </NuxtLink>
        <nav class="bd-nav-main" :aria-label="label ?? t('bd.header.nav')">
          <ul class="bd-nav-links">
            <li v-for="link in links" :key="link.id" :data-kind="link.anchor ? 'anchor' : link.action ? 'action' : undefined">
              <a v-if="link.anchor" :href="link.to" class="bd-nav-link">{{ link.label }}</a>
              <NuxtLink
                v-else
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
          <BdAccountMenu v-if="accountsOn" compact />
          <BdSearchTrigger
            v-if="searchOn"
            class="bd-iconbtn"
            :aria-label="t('bd.header.search')"
            @search="emit('search')"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6" /><path d="M15.5 15.5 L20 20" /></svg>
          </BdSearchTrigger>
          <BdMenuTrigger
            class="bd-iconbtn"
            :aria-label="isStatic ? t('bd.mobile.menu') : t('bd.header.menu')"
            :open="menuOpen"
            @menu="emit('menu')"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M4 7 H20 M4 12 H20 M4 17 H20" /></svg>
          </BdMenuTrigger>
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
        <p v-if="hud.city" class="bd-meta bd-hud">
          <span class="bd-hud-mark" aria-hidden="true">◆</span>
          <span>{{ hud.city }}</span>
          <span v-if="hud.coords" class="bd-hud-extra">{{ hud.coords }}</span>
          <span v-if="hud.altitude" class="bd-hud-extra">{{ hud.altitude }}</span>
        </p>
        <div class="bd-strip-actions">
          <NuxtLink v-if="fediverseOn" :to="`${localizePath('/')}#fediverso`" class="bd-chip" :aria-label="t('bd.header.fediverse', { handle: fediverseUser })">
            <span class="bd-hud-mark" aria-hidden="true">◆</span> {{ fediverseUser }}
          </NuxtLink>
          <BdSearchTrigger v-if="searchOn" class="bd-chip" shortcut @search="emit('search')">
            {{ t('bd.header.search') }} <kbd v-if="!isStatic" class="bd-kbd" aria-hidden="true">{{ shortcut }}</kbd>
          </BdSearchTrigger>
          <BdThemeSwitch @change="emit('theme', $event)" />
          <BdAccountMenu v-if="accountsOn" />
        </div>
      </div>
    </div>

    <div v-if="reading" class="bd-progress" :style="progressStyle" aria-hidden="true">
      <div class="bd-progress-bar" />
      <ThemeProgressMarker :progress="percent" />
    </div>
  </header>
</template>
