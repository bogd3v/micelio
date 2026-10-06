<script setup lang="ts">
import { FOOTER_SOCIALS } from '~/helpers/site'
import { resolveSourceUrl } from '~/helpers/source'

defineOptions({ name: 'RegionFooterMinimal' })

defineProps<{
  label?: string
}>()

interface FooterLink {
  id: string
  label: string
  to: string
  external?: boolean
}

interface SocialLink {
  id: string
  label: string
  href: string
}

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()
const fediverseUser = useFediverseUser()
const fediverseOn = useModule('fediverse')
const newsletterOn = useModule('newsletter')

const year = new Date().getFullYear()
const sourceUrl = resolveSourceUrl(useRuntimeConfig().public.sourceUrl)

const sections = useNavLinks()
const socials = computed<SocialLink[]>(() =>
  site.value.socialLinks.flatMap((link) => {
    const display = FOOTER_SOCIALS[link.network]
    return display ? [{ id: link.network, label: display.label, href: link.url }] : []
  }),
)
const subscriptions = computed<FooterLink[]>(() => [
  { id: 'rss', label: t('bd.footer.rss'), to: '/feed.xml', external: true },
  ...(fediverseOn.value ? [{ id: 'fediverse', label: t('bd.footer.fediverse', { handle: fediverseUser }), to: `${localizePath('/')}#fediverso` }] : []),
  ...(newsletterOn.value ? [{ id: 'newsletter', label: t('bd.footer.newsletter'), to: `${localizePath('/')}#newsletter` }] : []),
])
</script>

<template>
  <footer class="bd-foot" data-layout="minimal">
    <div class="bd-foot-main">
      <NuxtLink :to="localizePath('/')" class="bd-foot-brand" :aria-label="t('bd.header.home', { site: site.name })">
        <ThemeMark :size="32" context="footer" />
      </NuxtLink>
      <nav class="bd-foot-nav" :aria-label="label ?? t('bd.footer.navigate')">
        <NuxtLink v-for="link in sections" :key="link.id" :to="link.to" class="bd-foot-link">{{ link.label }}</NuxtLink>
      </nav>
      <ul v-if="socials.length" class="bd-foot-socials" :aria-label="t('bd.footer.social')">
        <li v-for="social in socials" :key="social.id">
          <a :href="social.href" class="bd-foot-soc" target="_blank" rel="noopener noreferrer me">
            <span>{{ social.label }}</span>
            <span class="bd-foot-soc-arrow" aria-hidden="true">↗</span>
          </a>
        </li>
      </ul>
    </div>

    <div class="bd-meta bd-foot-credits">
      <span class="bd-foot-legal">
        <span>© {{ year }} {{ site.name }} · {{ site.author.name }}</span>
        <NuxtLink :to="localizePath('/privacy')" class="bd-foot-privacy">{{ t('bd.footer.privacy') }}</NuxtLink>
        <a :href="sourceUrl" class="bd-foot-privacy bd-foot-source" target="_blank" rel="noopener noreferrer">{{ t('bd.footer.source') }}<span aria-hidden="true">↗</span></a>
      </span>
      <template v-for="link in subscriptions" :key="link.id">
        <a v-if="link.external" :href="link.to" class="bd-foot-link" target="_blank" rel="noopener noreferrer">{{ link.label }}<span aria-hidden="true">↗</span></a>
        <NuxtLink v-else :to="link.to" class="bd-foot-link">{{ link.label }}</NuxtLink>
      </template>
    </div>
  </footer>
</template>
