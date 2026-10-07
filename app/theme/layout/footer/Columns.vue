<script setup lang="ts">
import { blogPath } from '~/helpers/blog'
import { CATEGORIES, categoryColor } from '~/helpers/categories'
import { FOOTER_SOCIALS } from '~/helpers/site'
import { resolveSourceUrl } from '~/helpers/source'

defineOptions({ name: 'RegionFooterColumns' })

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

const { t, te } = useI18n()
const hud = useThemeHud()
const { localizePath } = useLocaleUtils()
const site = useSite()
const fediverseUser = useFediverseUser()
const fediverseOn = useModule('fediverse')
const newsletterOn = useModule('newsletter')
const supportOn = useModule('support')
const { isStatic, menuId } = useStaticSite()

const year = new Date().getFullYear()
const sourceUrl = resolveSourceUrl(useRuntimeConfig().public.sourceUrl)

const socials = computed<SocialLink[]>(() =>
  site.value.socialLinks.flatMap((link) => {
    const display = FOOTER_SOCIALS[link.network]
    return display ? [{ id: link.network, ...display, href: link.url }] : []
  }),
)
const sections = useNavLinks()
const topics = computed<FooterLink[]>(() =>
  CATEGORIES.map(slug => ({
    id: slug,
    label: t(`bd.categories.${slug}`),
    to: blogPath({ category: slug, page: 1 }, localizePath('/blog')),
    color: categoryColor(slug),
  })),
)
const subscriptions = computed<FooterLink[]>(() => [
  { id: 'rss', label: t('bd.footer.rss'), to: '/feed.xml', external: true },
  ...(fediverseOn.value ? [{ id: 'fediverse', label: t('bd.footer.fediverse', { handle: fediverseUser }), to: `${localizePath('/')}#fediverso` }] : []),
  ...(newsletterOn.value ? [{ id: 'newsletter', label: t('bd.footer.newsletter'), to: `${localizePath('/')}#newsletter` }] : []),
  ...(supportOn.value
    ? [{
        id: 'coffee',
        label: t('bd.footer.coffee'),
        to: `https://www.buymeacoffee.com/${site.value.supportHandle}`,
        external: true,
        mobileOnly: true,
      }]
    : []),
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
  open: isStatic,
  links: sections.value,
}))
const subscribeGroup = computed<FooterGroup>(() => ({
  id: 'subscribe',
  label: t('bd.footer.subscribe'),
  summary: fediverseOn.value ? t('bd.footer.subscribeSummary') : t('bd.footer.subscribeSummaryRss'),
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
  <footer class="bd-foot" data-layout="columns">
    <div class="bd-foot-main">
      <div class="bd-foot-brand-col">
        <NuxtLink :to="localizePath('/')" class="bd-foot-brand bd-wide" :aria-label="t('bd.header.home', { site: site.name })">
          <ThemeMark :size="56" context="footer" />
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

      <div :id="isStatic ? menuId : undefined" class="bd-foot-accordions">
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
        <div v-if="isStatic" class="bd-acc-body">
          <BdLangSwitch />
        </div>
      </div>
    </div>

    <ThemeDivider placement="footer" />

    <div class="bd-meta bd-foot-credits">
      <span class="bd-foot-legal">
        <span>© {{ year }} {{ site.name }} · {{ site.author.name }}</span>
        <NuxtLink :to="localizePath('/privacy')" class="bd-foot-privacy">{{ t('bd.footer.privacy') }}</NuxtLink>
        <a :href="sourceUrl" class="bd-foot-privacy bd-foot-source" target="_blank" rel="noopener noreferrer">{{ t('bd.footer.source') }}<span aria-hidden="true">↗</span></a>
      </span>
      <span v-if="hud.madeIn">{{ hud.madeIn }} <span v-if="hud.coords" class="bd-foot-diamond" aria-hidden="true">◆</span> {{ hud.coords }}</span>
      <span v-if="te('theme.divider.credit')">{{ t('theme.divider.credit') }}</span>
      <a v-if="isStatic" href="#main-content" class="bd-foot-row bd-foot-top">
        <span>{{ t('common.backToTop') }}</span>
        <span class="bd-foot-row-arrow" aria-hidden="true">↑</span>
      </a>
      <button v-else type="button" class="bd-foot-row bd-foot-top" @click="scrollToTop">
        <span>{{ t('common.backToTop') }}</span>
        <span class="bd-foot-row-arrow" aria-hidden="true">↑</span>
      </button>
    </div>
  </footer>
</template>
