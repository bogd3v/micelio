<script setup lang="ts">
import { BROWSER_STORAGE_KEYS, SITE_COOKIES } from '~/helpers/privacy'
import { modes } from '#micelio/theme'
import { formatDotDate } from '~/helpers/formatDate'
import { THEME_STORAGE_KEY, formatModeList } from '~/helpers/theme'

interface PrivacySection {
  id: string
  label: string
}

const { t, locale } = useI18n()
const { modeLabel } = useTheme()
const site = useSite()
const accountsOn = useModule('accounts')
const newsletterOn = useModule('newsletter')
const commentsOn = useModule('comments')
const { isStatic } = useStaticSite()
const providerName = useRuntimeConfig().public.newsletterProvider.host
const { canonicalUrl } = useCanonicalUrl('/privacy')
const defaultOgImage = useDefaultOgImage()

const contactEmail = computed<string>(() => site.value.privacyContactEmail)
const updatedAt = computed<string>(() => formatDotDate(site.value.privacyUpdatedAt))

const modeNames = computed<string>(() => formatModeList(
  modes.map(mode => modeLabel(mode.id)),
  locale.value,
))

// With one mode nothing ever writes bd-theme
const storageKeys = BROWSER_STORAGE_KEYS.filter(key => key !== THEME_STORAGE_KEY || modes.length > 1)

const sections = computed<PrivacySection[]>(() => [
  { id: 'analytics', label: t('privacy.analytics.label') },
  { id: 'cookies', label: t('privacy.cookies.label') },
  { id: 'browser', label: t('privacy.browser.label') },
  { id: 'data', label: t('privacy.data.label') },
  { id: 'rights', label: t('privacy.rights.label') },
])

useSeoMeta({
  title: () => t('privacy.meta.title', { site: site.value.name }),
  ogTitle: () => t('privacy.meta.title', { site: site.value.name }),
  description: () => t('privacy.meta.description', { site: site.value.name }),
  ogDescription: () => t('privacy.meta.description', { site: site.value.name }),
  ogImage: () => defaultOgImage.value,
  ogUrl: () => canonicalUrl.value,
  twitterCard: 'summary',
  twitterTitle: () => t('privacy.meta.title', { site: site.value.name }),
  twitterDescription: () => t('privacy.meta.description', { site: site.value.name }),
})

useHead({
  link: [{ rel: 'canonical', href: () => canonicalUrl.value }],
})
</script>

<template>
  <div class="bd-privacy">
    <header class="bd-privacy-head">
      <p class="bd-eyebrow bd-privacy-updated">{{ updatedAt ? t('privacy.eyebrow', { date: updatedAt }) : t('privacy.eyebrowUndated') }}</p>
      <h1 class="bd-wide bd-privacy-title">{{ t('privacy.title') }}</h1>
      <p class="bd-privacy-lead">{{ t('privacy.lead', { site: site.name }) }}</p>
      <ul class="bd-privacy-facts" :aria-label="t('privacy.facts.label')">
        <li class="bd-privacy-fact">
          <span class="bd-wide bd-privacy-fact-value">0</span>
          <span class="bd-meta bd-privacy-fact-label">{{ t('privacy.facts.tracking') }}</span>
        </li>
        <li class="bd-privacy-fact">
          <span class="bd-wide bd-privacy-fact-value">{{ SITE_COOKIES.length }}</span>
          <span class="bd-meta bd-privacy-fact-label">{{ t('privacy.facts.session', SITE_COOKIES.length) }}</span>
        </li>
        <li class="bd-privacy-fact">
          <span class="bd-wide bd-privacy-fact-value">{{ t('privacy.facts.anonymous') }}</span>
          <span class="bd-meta bd-privacy-fact-label">{{ t('privacy.facts.analytics') }}</span>
        </li>
      </ul>
    </header>

    <nav class="bd-privacy-toc" :aria-label="t('privacy.toc')">
      <span class="bd-eyebrow bd-privacy-toc-title" aria-hidden="true">{{ t('privacy.toc') }}</span>
      <a v-for="section in sections" :key="section.id" :href="`#${section.id}`" class="bd-privacy-toc-link">{{ section.label }}</a>
    </nav>

    <div class="bd-privacy-body">
      <section id="analytics" class="bd-privacy-section" aria-labelledby="analytics-title">
        <p class="bd-eyebrow bd-privacy-label">{{ t('privacy.analytics.label') }}</p>
        <h2 id="analytics-title">{{ t('privacy.analytics.title') }}</h2>
        <i18n-t keypath="privacy.analytics.body" tag="p" scope="global">
          <template #umami><strong>Umami</strong></template>
          <template #noCookies><strong>{{ t('privacy.analytics.noCookies') }}</strong></template>
        </i18n-t>
        <p>{{ t('privacy.analytics.blockers') }}</p>
      </section>

      <section id="cookies" class="bd-privacy-section" aria-labelledby="cookies-title">
        <p class="bd-eyebrow bd-privacy-label">{{ t('privacy.cookies.label') }}</p>
        <h2 id="cookies-title">{{ accountsOn ? t('privacy.cookies.title') : t('privacy.cookies.titleNone') }}</h2>
        <table v-if="accountsOn" class="bd-privacy-table">
          <caption class="bd-sr">{{ t('privacy.cookies.caption', { site: site.name }) }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ t('privacy.cookies.name') }}</th>
              <th scope="col">{{ t('privacy.cookies.purpose') }}</th>
              <th scope="col">{{ t('privacy.cookies.when') }}</th>
              <th scope="col">{{ t('privacy.cookies.duration') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cookie in SITE_COOKIES" :key="cookie.name">
              <td class="bd-privacy-key">{{ cookie.name }}</td>
              <td>{{ t(`privacy.cookies.items.${cookie.name}.purpose`) }}</td>
              <td class="bd-privacy-when">{{ t(`privacy.cookies.items.${cookie.name}.when`) }}</td>
              <td class="bd-privacy-duration">{{ t('privacy.cookies.days', cookie.maxAgeDays) }}</td>
            </tr>
          </tbody>
        </table>
        <p>{{ t('privacy.cookies.none') }}</p>
      </section>

      <section id="browser" class="bd-privacy-section" aria-labelledby="browser-title">
        <p class="bd-eyebrow bd-privacy-label">{{ t('privacy.browser.label') }}</p>
        <h2 id="browser-title">{{ t('privacy.browser.title') }}</h2>
        <i18n-t keypath="privacy.browser.body" tag="p" scope="global">
          <template #local><strong>{{ t('privacy.browser.local') }}</strong></template>
        </i18n-t>
        <dl class="bd-privacy-keys">
          <div v-for="key in storageKeys" :key="key" class="bd-privacy-kv">
            <dt class="bd-privacy-key">{{ key }}</dt>
            <dd>{{ t(`privacy.browser.items.${key}`, { modes: modeNames }) }}</dd>
          </div>
        </dl>
      </section>

      <section id="data" class="bd-privacy-section" aria-labelledby="data-title">
        <p class="bd-eyebrow bd-privacy-label">{{ t('privacy.data.label') }}</p>
        <h2 id="data-title">{{ t('privacy.data.title') }}</h2>
        <p v-if="accountsOn"><strong>{{ t('privacy.data.account') }}</strong> {{ t('privacy.data.accountText') }}</p>
        <p v-if="newsletterOn && isStatic"><strong>{{ t('privacy.data.newsletter') }}</strong> {{ t('privacy.data.newsletterExternalText', { provider: providerName }) }}</p>
        <p v-else-if="newsletterOn"><strong>{{ t('privacy.data.newsletter') }}</strong> {{ t('privacy.data.newsletterText') }}</p>
        <p v-if="commentsOn"><strong>{{ t('privacy.data.comments') }}</strong> {{ t('privacy.data.commentsText') }}</p>
        <p v-if="!accountsOn && !newsletterOn && !commentsOn">{{ t('privacy.data.none') }}</p>
      </section>

      <section id="rights" class="bd-privacy-section" aria-labelledby="rights-title">
        <p class="bd-eyebrow bd-privacy-label">{{ t('privacy.rights.label') }}</p>
        <h2 id="rights-title">{{ t('privacy.rights.title') }}</h2>
        <i18n-t v-if="contactEmail" keypath="privacy.rights.body" tag="p" scope="global">
          <template #email><a :href="`mailto:${contactEmail}`"><strong>{{ contactEmail }}</strong></a></template>
        </i18n-t>
        <p v-else>{{ t('privacy.rights.bodyNoContact') }}</p>
      </section>
    </div>
  </div>
</template>
