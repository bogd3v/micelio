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
// Static builds have no JS: CSS draws the number (the ternary folds away in dynamic builds, docs/performance.md)
const isStaticBuild = __STATIC_BUILD__
const StaticRead = __STATIC_BUILD__ ? defineAsyncComponent(() => import('~/components/layout/ReadPercent.vue')) : undefined
</script>

<template>
  <header data-layout="centered" :class="['myc-header', { 'myc-header-reading': reading, 'myc-header-auto': tracking }]">
    <div class="myc-nav">
      <div class="myc-header-inner">
        <NuxtLink :to="localizePath('/')" class="myc-brand" :aria-label="t('myc.header.home', { site: site.name })">
          <ThemeMark :size="30" context="header" />
        </NuxtLink>
        <nav class="myc-nav-main" :aria-label="label ?? t('myc.header.nav')">
          <ul class="myc-nav-links">
            <li v-for="link in links" :key="link.id" :data-kind="link.anchor ? 'anchor' : link.action ? 'action' : undefined">
              <a v-if="link.anchor" :href="link.to" class="myc-nav-link">{{ link.label }}</a>
              <NuxtLink
                v-else
                :to="link.to"
                class="myc-nav-link"
                :aria-current="active === link.id ? 'page' : undefined"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
        <MycLangSwitch class="myc-nav-lang" @change="emit('lang', $event)" />
        <div class="myc-nav-mobile">
          <MycAccountMenu v-if="accountsOn" compact />
          <MycSearchTrigger
            v-if="searchOn"
            class="myc-iconbtn"
            :aria-label="t('myc.header.search')"
            @search="emit('search')"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6" /><path d="M15.5 15.5 L20 20" /></svg>
          </MycSearchTrigger>
          <MycMenuTrigger
            class="myc-iconbtn"
            :aria-label="isStatic ? t('myc.mobile.menu') : t('myc.header.menu')"
            :open="menuOpen"
            @menu="emit('menu')"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M4 7 H20 M4 12 H20 M4 17 H20" /></svg>
          </MycMenuTrigger>
        </div>
      </div>
    </div>

    <div v-if="reading" class="myc-strip">
      <div class="myc-header-inner">
        <nav class="myc-crumbs myc-meta" :aria-label="t('myc.header.breadcrumbs')">
          <NuxtLink :to="localizePath('/')" class="myc-strip-link">{{ t('nav.home') }}</NuxtLink>
          <span aria-hidden="true">/</span>
          <NuxtLink :to="localizePath('/blog')" class="myc-strip-link">{{ t('nav.blog') }}</NuxtLink>
          <template v-if="section && mounted">
            <span aria-hidden="true">/</span>
            <span class="myc-crumbs-current" aria-current="page">{{ section }}</span>
          </template>
        </nav>
        <div class="myc-strip-actions">
          <span class="myc-meta myc-strip-read"><component :is="StaticRead" v-if="isStaticBuild" :percent="percent" /><template v-else>{{ t('myc.header.read', { percent }) }}</template></span>
          <MycThemeSwitch @change="emit('theme', $event)" />
        </div>
      </div>
    </div>
    <div v-else class="myc-strip">
      <div class="myc-header-inner">
        <p v-if="hud.city" class="myc-meta myc-hud">
          <span class="myc-hud-mark" aria-hidden="true">◆</span>
          <span>{{ hud.city }}</span>
          <span v-if="hud.coords" class="myc-hud-extra">{{ hud.coords }}</span>
          <span v-if="hud.altitude" class="myc-hud-extra">{{ hud.altitude }}</span>
        </p>
        <div class="myc-strip-actions">
          <NuxtLink v-if="fediverseOn" :to="`${localizePath('/')}#fediverso`" class="myc-chip" :aria-label="t('myc.header.fediverse', { handle: fediverseUser })">
            <span class="myc-hud-mark" aria-hidden="true">◆</span> {{ fediverseUser }}
          </NuxtLink>
          <MycSearchTrigger v-if="searchOn" class="myc-chip" shortcut @search="emit('search')">
            {{ t('myc.header.search') }} <kbd v-if="!isStatic" class="myc-kbd" aria-hidden="true">{{ shortcut }}</kbd>
          </MycSearchTrigger>
          <MycThemeSwitch @change="emit('theme', $event)" />
          <MycAccountMenu v-if="accountsOn" />
        </div>
      </div>
    </div>

    <div v-if="reading" class="myc-progress" :style="progressStyle" aria-hidden="true">
      <div class="myc-progress-bar" />
      <ThemeProgressMarker :progress="percent" />
    </div>
  </header>
</template>
