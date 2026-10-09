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
  anchor?: boolean
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
const { isStatic, blogEnabled, menuId } = useStaticSite()

const year = new Date().getFullYear()
const sourceUrl = resolveSourceUrl(useRuntimeConfig().public.sourceUrl)

const socials = computed<SocialLink[]>(() =>
  site.value.socialLinks.flatMap((link) => {
    const display = FOOTER_SOCIALS[link.network]
    return display ? [{ id: link.network, ...display, href: link.url }] : []
  }),
)
const sections = useNavLinks()
// No blog, no categories to list
const topics = computed<FooterLink[]>(() =>
  blogEnabled
    ? CATEGORIES.map(slug => ({
        id: slug,
        label: t(`myc.categories.${slug}`),
        to: blogPath({ category: slug, page: 1 }, localizePath('/blog')),
        color: categoryColor(slug),
      }))
    : [],
)
const subscriptions = computed<FooterLink[]>(() => [
  ...(blogEnabled ? [{ id: 'rss', label: t('myc.footer.rss'), to: '/feed.xml', external: true }] : []),
  ...(fediverseOn.value ? [{ id: 'fediverse', label: t('myc.footer.fediverse', { handle: fediverseUser }), to: `${localizePath('/')}#fediverso` }] : []),
  ...(newsletterOn.value ? [{ id: 'newsletter', label: t('myc.footer.newsletter'), to: `${localizePath('/')}#newsletter` }] : []),
  ...(supportOn.value && site.value.supportHandle
    ? [{
        id: 'coffee',
        label: t('myc.footer.coffee'),
        to: `https://www.buymeacoffee.com/${site.value.supportHandle}`,
        external: true,
        mobileOnly: true,
      }]
    : []),
])
const topicGroup = computed<FooterGroup>(() => ({
  id: 'topics',
  label: t('myc.footer.topics'),
  summary: String(topics.value.length).padStart(2, '0'),
  open: true,
  links: topics.value,
}))
const navigateGroup = computed<FooterGroup>(() => ({
  id: 'navigate',
  label: t('myc.footer.navigate'),
  summary: String(sections.value.length).padStart(2, '0'),
  open: isStatic,
  links: sections.value,
}))
const subscribeGroup = computed<FooterGroup>(() => ({
  id: 'subscribe',
  label: t('myc.footer.subscribe'),
  summary: fediverseOn.value ? t('myc.footer.subscribeSummary') : t('myc.footer.subscribeSummaryRss'),
  open: false,
  links: subscriptions.value,
}))
// A group with no links (no categories or feed without a blog) is left out
const desktopGroups = computed<FooterGroup[]>(() =>
  [navigateGroup.value, topicGroup.value, subscribeGroup.value].map(group => ({
    ...group,
    links: group.links.filter(link => !link.mobileOnly),
  })).filter(group => group.links.length),
)
const mobileGroups = computed<FooterGroup[]>(() => [topicGroup.value, navigateGroup.value, subscribeGroup.value].filter(group => group.links.length))

function scrollToTop(): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
}
</script>

<template>
  <footer class="myc-foot" data-layout="columns">
    <div class="myc-foot-main">
      <div class="myc-foot-brand-col">
        <NuxtLink :to="localizePath('/')" class="myc-foot-brand myc-wide" :aria-label="t('myc.header.home', { site: site.name })">
          <ThemeMark :size="56" context="footer" />
        </NuxtLink>
        <p class="myc-foot-tagline">{{ t('myc.footer.tagline') }}</p>
        <ul v-if="socials.length" class="myc-foot-socials" :aria-label="t('myc.footer.social')">
          <li v-for="social in socials" :key="social.id">
            <a :href="social.href" class="myc-foot-soc" target="_blank" rel="noopener noreferrer me">
              <span class="myc-foot-soc-abbr" aria-hidden="true">{{ social.abbr }}</span>
              <span>{{ social.label }}</span>
              <span class="myc-foot-soc-arrow" aria-hidden="true">↗</span>
            </a>
          </li>
        </ul>
      </div>

      <nav
        v-for="group in desktopGroups"
        :key="group.id"
        :class="['myc-foot-nav', `myc-foot-nav-${group.id}`]"
        :aria-labelledby="`myc-foot-${group.id}`"
      >
        <h2 :id="`myc-foot-${group.id}`" class="myc-eyebrow myc-foot-heading">{{ group.label }}</h2>
        <template v-for="link in group.links" :key="link.id">
          <a
            v-if="link.external"
            :href="link.to"
            class="myc-foot-link"
            target="_blank"
            rel="noopener noreferrer"
          >{{ link.label }}<span aria-hidden="true">↗</span></a>
          <a v-else-if="link.anchor" :href="link.to" class="myc-foot-link">{{ link.label }}</a>
          <NuxtLink v-else :to="link.to" class="myc-foot-link">
            <span v-if="link.color" class="myc-foot-dot" :style="{ background: link.color }" aria-hidden="true" />{{ link.label }}
          </NuxtLink>
        </template>
      </nav>

      <div :id="isStatic ? menuId : undefined" class="myc-foot-accordions">
        <details v-for="group in mobileGroups" :key="group.id" class="myc-acc" :open="group.open">
          <summary>
            <span class="myc-eyebrow myc-acc-label">{{ group.label }}</span>
            <span class="myc-acc-aside">
              <span class="myc-meta myc-acc-summary">{{ group.summary }}</span>
              <span class="myc-acc-mark" aria-hidden="true" />
            </span>
          </summary>
          <div class="myc-acc-body">
            <template v-for="link in group.links" :key="link.id">
              <a
                v-if="link.external"
                :href="link.to"
                class="myc-foot-row"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{{ link.label }}</span>
                <span class="myc-foot-row-arrow" aria-hidden="true">↗</span>
              </a>
              <a v-else-if="link.anchor" :href="link.to" class="myc-foot-row">
                <span class="myc-foot-row-label">{{ link.label }}</span>
                <span class="myc-foot-row-arrow" aria-hidden="true">→</span>
              </a>
              <NuxtLink v-else :to="link.to" class="myc-foot-row">
                <span class="myc-foot-row-label">
                  <span v-if="link.color" class="myc-foot-dot" :style="{ background: link.color }" aria-hidden="true" />{{ link.label }}
                </span>
                <span class="myc-foot-row-arrow" aria-hidden="true">→</span>
              </NuxtLink>
            </template>
          </div>
        </details>
        <div v-if="isStatic" class="myc-acc-body">
          <MycLangSwitch />
        </div>
      </div>
    </div>

    <ThemeDivider placement="footer" />

    <div class="myc-meta myc-foot-credits">
      <span class="myc-foot-legal">
        <span>© {{ year }} {{ site.name }}<template v-if="site.author.name"> · {{ site.author.name }}</template></span>
        <NuxtLink :to="localizePath('/privacy')" class="myc-foot-privacy">{{ t('myc.footer.privacy') }}</NuxtLink>
        <a :href="sourceUrl" class="myc-foot-privacy myc-foot-source" target="_blank" rel="noopener noreferrer">{{ t('myc.footer.source') }}<span aria-hidden="true">↗</span></a>
      </span>
      <span v-if="hud.madeIn">{{ hud.madeIn }} <span v-if="hud.coords" class="myc-foot-diamond" aria-hidden="true">◆</span> {{ hud.coords }}</span>
      <span v-if="te('theme.divider.credit')">{{ t('theme.divider.credit') }}</span>
      <a v-if="isStatic" href="#main-content" class="myc-foot-row myc-foot-top">
        <span>{{ t('common.backToTop') }}</span>
        <span class="myc-foot-row-arrow" aria-hidden="true">↑</span>
      </a>
      <button v-else type="button" class="myc-foot-row myc-foot-top" @click="scrollToTop">
        <span>{{ t('common.backToTop') }}</span>
        <span class="myc-foot-row-arrow" aria-hidden="true">↑</span>
      </button>
    </div>
  </footer>
</template>
