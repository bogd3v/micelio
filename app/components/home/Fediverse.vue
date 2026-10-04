<script setup lang="ts">
import { Locale } from '~/interfaces'
import { padCount } from '~/helpers/search'

interface AfterStep {
  id: 'follow' | 'read' | 'reply'
  text: string
}

const COPIED_MS = 1600
const JOIN_STEPS = 3
const GLOSSARY: string[] = ['fediverse', 'instance', 'follow', 'boost']

const { t, locale } = useI18n()
const config = useRuntimeConfig()
const site = useSite()
const { copy, copied } = useClipboard({ copiedDuring: COPIED_MS, legacy: true })
const { instance, error, preview, open: follow } = useFediverseInstance(() => config.public.fediverseActorUrl)

const handle = computed<string>(() => config.public.fediverseHandle)
const handleParts = computed<{ user: string, domain: string }>(() => {
  const at = handle.value.lastIndexOf('@')
  return { user: handle.value.slice(0, at), domain: handle.value.slice(at) }
})
const hint = computed<string>(() => {
  if (error.value === 'empty') return t('home.fediverse.errorEmpty')
  if (error.value === 'invalid') return t('home.fediverse.errorInvalid')
  if (preview.value) return t('home.fediverse.willOpen', { instance: preview.value })
  return t('home.fediverse.hint')
})
const joinUrl = computed<string>(() =>
  locale.value === Locale.SpanishColombia ? 'https://joinmastodon.org/es/servers' : 'https://joinmastodon.org/servers',
)
const joinSteps = computed<string[]>(() =>
  Array.from({ length: JOIN_STEPS }, (_, index) => t(`home.fediverse.join.steps.${index}`)),
)
const afterSteps = computed<AfterStep[]>(() => [
  { id: 'follow', text: t('home.fediverse.after.follow.text', { handle: handle.value }) },
  { id: 'read', text: t('home.fediverse.after.read.text') },
  { id: 'reply', text: t('home.fediverse.after.reply.text') },
])

function copyHandle(): void {
  copy(handle.value)
}
</script>

<template>
  <section id="fediverso" class="bd-home-section bd-fedi bd-reveal" aria-labelledby="fediverse-title">
    <div class="bd-fedi-head">
      <div class="bd-home-heading">
        <BdMastodonLogo class="bd-fedi-logo" :label="t('home.fediverse.logo')" />
        <p class="bd-eyebrow bd-home-eyebrow">{{ t('home.fediverse.eyebrow') }}</p>
        <h2 id="fediverse-title" class="bd-home-title bd-stretch">{{ t('home.fediverse.title') }}</h2>
      </div>
      <p class="bd-fedi-intro">
        <span class="bd-fedi-intro-short">{{ t('home.fediverse.introShort', { site: site.name }) }}</span>
        <span class="bd-fedi-intro-long">{{ t('home.fediverse.intro', { site: site.name }) }}</span>
      </p>
    </div>

    <div class="bd-fedi-how">
      <span class="bd-eyebrow bd-home-eyebrow">{{ t('home.fediverse.how') }}</span>
      <span class="bd-meta bd-fedi-swipe" aria-hidden="true">{{ t('home.fediverse.swipe') }}</span>
    </div>
    <HomeFediverseCards :user="handleParts.user" :domain="handleParts.domain" />

    <div class="bd-fedi-join">
      <div class="bd-fedi-card-heading">
        <p class="bd-eyebrow bd-fedi-join-eyebrow">{{ t('home.fediverse.join.eyebrow') }}</p>
        <h3 class="bd-fedi-action-title">{{ t('home.fediverse.join.title') }}</h3>
      </div>
      <ol class="bd-fedi-join-steps">
        <li v-for="(step, index) in joinSteps" :key="index">
          <span class="bd-fedi-join-number" aria-hidden="true">{{ padCount(index + 1) }}</span>
          <span>{{ step }}</span>
        </li>
      </ol>
      <a
        class="bd-chip bd-fedi-join-link"
        :href="joinUrl"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('home.fediverse.join.linkAria')"
      >
        {{ t('home.fediverse.join.link') }} <span aria-hidden="true">↗</span>
      </a>
    </div>

    <div class="bd-fedi-card">
      <span class="bd-corner bd-corner-tl" aria-hidden="true" />
      <span class="bd-corner bd-corner-br" aria-hidden="true" />
      <div class="bd-fedi-card-heading">
        <p class="bd-eyebrow bd-fedi-accent">{{ t('home.fediverse.account.eyebrow') }}</p>
        <h3 class="bd-fedi-action-title">{{ t('home.fediverse.account.title') }}</h3>
      </div>

      <form class="bd-fedi-form" novalidate @submit.prevent="follow">
        <label for="bd-fedi-instance" class="bd-fedi-label">{{ t('home.fediverse.instanceLabel') }}</label>
        <div class="bd-fedi-row">
          <input
            id="bd-fedi-instance"
            v-model="instance"
            class="bd-input"
            type="text"
            inputmode="url"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="mastodon.social"
            :aria-invalid="error ? 'true' : undefined"
            aria-describedby="bd-fedi-hint"
          >
          <BdButton type="submit" arrow>{{ t('home.fediverse.follow') }}</BdButton>
        </div>
        <p id="bd-fedi-hint" :class="['bd-meta bd-fedi-hint', { 'bd-fedi-hint-error': error }]" role="status">{{ hint }}</p>
      </form>

      <div class="bd-fedi-copy">
        <p class="bd-fedi-label">{{ t('home.fediverse.copyIntro') }}</p>
        <p class="font-mono bd-fedi-handle">
          <span class="bd-fedi-user">{{ handleParts.user }}</span><span class="bd-fedi-domain">{{ handleParts.domain }}</span>
        </p>
        <div>
          <button type="button" class="bd-chip" :aria-label="t('home.fediverse.copyAria', { handle })" @click="copyHandle">
            {{ copied ? t('home.fediverse.copied') : t('home.fediverse.copy') }}
          </button>
          <span class="bd-sr" aria-live="polite">{{ copied ? t('home.fediverse.copiedAnnounce', { handle }) : '' }}</span>
        </div>
      </div>
    </div>

    <div class="bd-fedi-after">
      <h3 class="bd-eyebrow bd-home-eyebrow">{{ t('home.fediverse.after.title') }}</h3>
      <ol class="bd-fedi-after-steps">
        <li v-for="step in afterSteps" :key="step.id">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--link)" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false">
            <template v-if="step.id === 'follow'">
              <circle cx="9" cy="8" r="3.5" />
              <path d="M3 19 C3 14.5 6 12.5 9 12.5 C12 12.5 15 14.5 15 19" />
              <path d="M18 7 V13 M15 10 H21" />
            </template>
            <template v-else-if="step.id === 'read'">
              <rect x="4" y="4" width="16" height="16" />
              <path d="M7 9 H17 M7 12.5 H17 M7 16 H13" />
            </template>
            <template v-else>
              <path d="M10 7 L4 12 L10 17" />
              <path d="M4 12 H14 C17.5 12 20 14.5 20 18" />
            </template>
          </svg>
          <div>
            <p class="bd-fedi-step-title">{{ t(`home.fediverse.after.${step.id}.title`) }}</p>
            <p class="bd-fedi-step-text">{{ step.text }}</p>
          </div>
        </li>
      </ol>
    </div>

    <div class="bd-fedi-glossary">
      <h3 class="bd-eyebrow bd-home-eyebrow">{{ t('home.fediverse.glossary.title') }}</h3>
      <dl>
        <div v-for="term in GLOSSARY" :key="term">
          <dt class="bd-eyebrow">{{ t(`home.fediverse.glossary.${term}.term`) }}</dt>
          <dd>{{ t(`home.fediverse.glossary.${term}.text`) }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
