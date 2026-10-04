<script setup lang="ts">
import { CATEGORIES, CATEGORY_INFO } from '~/helpers/categories'
import { FOOTER_SOCIALS } from '~/helpers/site'

interface FooterLink {
  id: string
  label: string
  to: string
  external?: boolean
  color?: string
  mobileOnly?: boolean
}

interface FooterGroup {
  id: string
  label: string
  summary: string
  open: boolean
  links: FooterLink[]
}

interface SocialLink {
  id: string
  label: string
  abbr: string
  href: string
}

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()
const fediverseUser = useFediverseUser()

const year = new Date().getFullYear()

const socials = computed<SocialLink[]>(() =>
  site.value.socialLinks.flatMap((link) => {
    const display = FOOTER_SOCIALS[link.network]
    return display ? [{ id: link.network, ...display, href: link.url }] : []
  }),
)
const sections = computed<FooterLink[]>(() => [
  { id: 'home', label: t('nav.home'), to: localizePath('/') },
  { id: 'blog', label: t('nav.blog'), to: localizePath('/blog') },
  { id: 'about', label: t('nav.about'), to: localizePath('/about') },
])
const topics = computed<FooterLink[]>(() =>
  CATEGORIES.map(slug => ({
    id: slug,
    label: t(`bd.categories.${slug}`),
    to: `${localizePath('/blog')}?category=${slug}`,
    color: `var(--${CATEGORY_INFO[slug].token})`,
  })),
)
const subscriptions = computed<FooterLink[]>(() => [
  { id: 'rss', label: t('bd.footer.rss'), to: '/feed.xml', external: true },
  { id: 'fediverse', label: t('bd.footer.fediverse', { handle: fediverseUser }), to: `${localizePath('/')}#fediverso` },
  { id: 'newsletter', label: t('bd.footer.newsletter'), to: `${localizePath('/')}#newsletter` },
  {
    id: 'coffee',
    label: t('bd.footer.coffee'),
    to: `https://www.buymeacoffee.com/${site.value.supportHandle}`,
    external: true,
    mobileOnly: true,
  },
])
const topicGroup = computed<FooterGroup>(() => ({
  id: 'topics',
  label: t('bd.footer.topics'),
  summary: String(topics.value.length).padStart(2, '0'),
  open: true,
  links: topics.value,
}))
const navigateGroup = computed<FooterGroup>(() => ({
  id: 'navigate',
  label: t('bd.footer.navigate'),
  summary: String(sections.value.length).padStart(2, '0'),
  open: false,
  links: sections.value,
}))
const subscribeGroup = computed<FooterGroup>(() => ({
  id: 'subscribe',
  label: t('bd.footer.subscribe'),
  summary: t('bd.footer.subscribeSummary'),
  open: false,
  links: subscriptions.value,
}))
const desktopGroups = computed<FooterGroup[]>(() =>
  [navigateGroup.value, topicGroup.value, subscribeGroup.value].map(group => ({
    ...group,
    links: group.links.filter(link => !link.mobileOnly),
  })),
)
const mobileGroups = computed<FooterGroup[]>(() => [topicGroup.value, navigateGroup.value, subscribeGroup.value])

function scrollToTop(): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
}
</script>

<template>
  <footer class="bd-foot">
    <div class="bd-foot-main">
      <div class="bd-foot-brand-col">
        <NuxtLink :to="localizePath('/')" class="bd-foot-brand bd-wide" :aria-label="t('bd.header.home', { site: site.name })">
          <BdLogo :size="56" />
          <span aria-hidden="true">Bog<span class="bd-foot-brand-dev">Dev</span></span>
        </NuxtLink>
        <p class="bd-foot-tagline">{{ t('bd.footer.tagline') }}</p>
        <ul class="bd-foot-socials" :aria-label="t('bd.footer.social')">
          <li v-for="social in socials" :key="social.id">
            <a :href="social.href" class="bd-foot-soc" target="_blank" rel="noopener noreferrer me">
              <span class="bd-foot-soc-abbr" aria-hidden="true">{{ social.abbr }}</span>
              <span>{{ social.label }}</span>
              <span class="bd-foot-soc-arrow" aria-hidden="true">↗</span>
            </a>
          </li>
        </ul>
      </div>

      <nav
        v-for="group in desktopGroups"
        :key="group.id"
        :class="['bd-foot-nav', `bd-foot-nav-${group.id}`]"
        :aria-labelledby="`bd-foot-${group.id}`"
      >
        <h2 :id="`bd-foot-${group.id}`" class="bd-eyebrow bd-foot-heading">{{ group.label }}</h2>
        <template v-for="link in group.links" :key="link.id">
          <a
            v-if="link.external"
            :href="link.to"
            class="bd-foot-link"
            target="_blank"
            rel="noopener noreferrer"
          >{{ link.label }}<span aria-hidden="true">↗</span></a>
          <NuxtLink v-else :to="link.to" class="bd-foot-link">
            <span v-if="link.color" class="bd-foot-dot" :style="{ background: link.color }" aria-hidden="true" />{{ link.label }}
          </NuxtLink>
        </template>
      </nav>

      <div class="bd-foot-accordions">
        <details v-for="group in mobileGroups" :key="group.id" class="bd-acc" :open="group.open">
          <summary>
            <span class="bd-eyebrow bd-acc-label">{{ group.label }}</span>
            <span class="bd-acc-aside">
              <span class="bd-meta bd-acc-summary">{{ group.summary }}</span>
              <span class="bd-acc-mark" aria-hidden="true" />
            </span>
          </summary>
          <div class="bd-acc-body">
            <template v-for="link in group.links" :key="link.id">
              <a
                v-if="link.external"
                :href="link.to"
                class="bd-foot-row"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{{ link.label }}</span>
                <span class="bd-foot-row-arrow" aria-hidden="true">↗</span>
              </a>
              <NuxtLink v-else :to="link.to" class="bd-foot-row">
                <span class="bd-foot-row-label">
                  <span v-if="link.color" class="bd-foot-dot" :style="{ background: link.color }" aria-hidden="true" />{{ link.label }}
                </span>
                <span class="bd-foot-row-arrow" aria-hidden="true">→</span>
              </NuxtLink>
            </template>
          </div>
        </details>
      </div>
    </div>

    <BdPanorama />

    <div class="bd-meta bd-foot-credits">
      <span class="bd-foot-legal">
        <span>© {{ year }} {{ site.name }} · {{ site.author.name }}</span>
        <NuxtLink :to="localizePath('/privacy')" class="bd-foot-privacy">{{ t('bd.footer.privacy') }}</NuxtLink>
      </span>
      <span>{{ t('bd.footer.madeIn') }} <span class="bd-foot-diamond" aria-hidden="true">◆</span> {{ t('bd.header.hud.coords') }}</span>
      <span>{{ t('bd.footer.illustration') }}</span>
      <button type="button" class="bd-foot-row bd-foot-top" @click="scrollToTop">
        <span>{{ t('common.backToTop') }}</span>
        <span class="bd-foot-row-arrow" aria-hidden="true">↑</span>
      </button>
    </div>
  </footer>
</template>
