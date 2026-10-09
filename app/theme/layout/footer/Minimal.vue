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
const { isStatic, blogEnabled, menuId } = useStaticSite()

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
  ...(blogEnabled ? [{ id: 'rss', label: t('myc.footer.rss'), to: '/feed.xml', external: true }] : []),
  ...(fediverseOn.value ? [{ id: 'fediverse', label: t('myc.footer.fediverse', { handle: fediverseUser }), to: `${localizePath('/')}#fediverso` }] : []),
  ...(newsletterOn.value ? [{ id: 'newsletter', label: t('myc.footer.newsletter'), to: `${localizePath('/')}#newsletter` }] : []),
])
</script>

<template>
  <footer class="myc-foot" data-layout="minimal">
    <div class="myc-foot-main">
      <NuxtLink :to="localizePath('/')" class="myc-foot-brand" :aria-label="t('myc.header.home', { site: site.name })">
        <ThemeMark :size="32" context="footer" />
      </NuxtLink>
      <nav :id="isStatic ? menuId : undefined" class="myc-foot-nav" :aria-label="label ?? t('myc.footer.navigate')">
        <template v-for="link in sections" :key="link.id">
          <a v-if="link.anchor" :href="link.to" class="myc-foot-link">{{ link.label }}</a>
          <NuxtLink v-else :to="link.to" class="myc-foot-link">{{ link.label }}</NuxtLink>
        </template>
      </nav>
      <MycLangSwitch v-if="isStatic" />
      <ul v-if="socials.length" class="myc-foot-socials" :aria-label="t('myc.footer.social')">
        <li v-for="social in socials" :key="social.id">
          <a :href="social.href" class="myc-foot-soc" target="_blank" rel="noopener noreferrer me">
            <span>{{ social.label }}</span>
            <span class="myc-foot-soc-arrow" aria-hidden="true">↗</span>
          </a>
        </li>
      </ul>
    </div>

    <div class="myc-meta myc-foot-credits">
      <span class="myc-foot-legal">
        <span>© {{ year }} {{ site.name }}<template v-if="site.author.name"> · {{ site.author.name }}</template></span>
        <NuxtLink :to="localizePath('/privacy')" class="myc-foot-privacy">{{ t('myc.footer.privacy') }}</NuxtLink>
        <a :href="sourceUrl" class="myc-foot-privacy myc-foot-source" target="_blank" rel="noopener noreferrer">{{ t('myc.footer.source') }}<span aria-hidden="true">↗</span></a>
      </span>
      <template v-for="link in subscriptions" :key="link.id">
        <a v-if="link.external" :href="link.to" class="myc-foot-link" target="_blank" rel="noopener noreferrer">{{ link.label }}<span aria-hidden="true">↗</span></a>
        <NuxtLink v-else :to="link.to" class="myc-foot-link">{{ link.label }}</NuxtLink>
      </template>
    </div>
  </footer>
</template>
