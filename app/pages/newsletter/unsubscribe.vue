<script setup lang="ts">
import { isNewsletterToken } from '~/helpers/newsletter'

type UnsubscribeStatus = 'ready' | 'done' | 'invalid'

interface FocusTarget {
  focus: () => void
}

const { t } = useI18n()
const route = useRoute()
const { localizePath } = useLocaleUtils()
const site = useSite()

const token = String(route.query.token ?? '')
const contactEmail = computed<string>(() => site.value.privacyContactEmail)

const status = ref<UnsubscribeStatus>(isNewsletterToken(token) ? 'ready' : 'invalid')
const error = ref('')
const submitting = ref(false)
const headingRef = ref<FocusTarget>()
const errorRef = ref<FocusTarget>()

async function unsubscribe(): Promise<void> {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    await $fetch('/api/newsletter/unsubscribe', { method: 'POST', body: { token } })
    status.value = 'done'
    await nextTick()
    headingRef.value?.focus()
  } catch {
    error.value = t('newsletter.unsubscribe.error')
    await nextTick()
    errorRef.value?.focus()
  } finally {
    submitting.value = false
  }
}

useSeoMeta({
  title: () => t('newsletter.unsubscribe.meta', { site: site.value.name }),
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div class="bd-unsubscribe">
    <div class="bd-account-card">
      <span class="bd-corner bd-corner-tl" aria-hidden="true" />
      <span class="bd-corner bd-corner-br" aria-hidden="true" />
      <div v-if="status === 'done'" class="bd-account-view">
        <AccountHeading ref="headingRef" :eyebrow="t('newsletter.unsubscribe.eyebrow')" :title="t('newsletter.unsubscribe.doneTitle')">
          {{ t('newsletter.unsubscribe.doneLead') }}
        </AccountHeading>
        <div>
          <BdButton :href="localizePath('/blog')" arrow>{{ t('newsletter.unsubscribe.blog') }}</BdButton>
        </div>
      </div>
      <div v-else-if="status === 'invalid'" class="bd-account-view">
        <AccountHeading :eyebrow="t('newsletter.unsubscribe.eyebrow')" :title="t('newsletter.unsubscribe.invalidTitle')">
          <i18n-t keypath="newsletter.unsubscribe.invalidLead" scope="global">
            <template #email><a :href="`mailto:${contactEmail}`" class="bd-inline">{{ contactEmail }}</a></template>
          </i18n-t>
        </AccountHeading>
        <div>
          <BdButton :href="localizePath('/blog')" variant="secondary">{{ t('newsletter.unsubscribe.blog') }}</BdButton>
        </div>
      </div>
      <form v-else class="bd-account-view" @submit.prevent="unsubscribe">
        <AccountHeading :eyebrow="t('newsletter.unsubscribe.eyebrow')" :title="t('newsletter.unsubscribe.title')">
          {{ t('newsletter.unsubscribe.lead') }}
        </AccountHeading>
        <AccountNotice v-if="error" ref="errorRef" tone="error">{{ error }}</AccountNotice>
        <div>
          <BdButton type="submit">{{ t('newsletter.unsubscribe.submit') }}</BdButton>
        </div>
      </form>
    </div>
  </div>
</template>
