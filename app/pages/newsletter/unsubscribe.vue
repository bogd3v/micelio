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
  <div class="myc-unsubscribe">
    <div class="myc-account-card">
      <span class="myc-corner myc-corner-tl" aria-hidden="true" />
      <span class="myc-corner myc-corner-br" aria-hidden="true" />
      <div v-if="status === 'done'" class="myc-account-view">
        <AccountHeading ref="headingRef" :eyebrow="t('newsletter.unsubscribe.eyebrow')" :title="t('newsletter.unsubscribe.doneTitle')">
          {{ t('newsletter.unsubscribe.doneLead') }}
        </AccountHeading>
        <div>
          <MycButton :href="localizePath('/blog')" arrow>{{ t('newsletter.unsubscribe.blog') }}</MycButton>
        </div>
      </div>
      <div v-else-if="status === 'invalid'" class="myc-account-view">
        <AccountHeading :eyebrow="t('newsletter.unsubscribe.eyebrow')" :title="t('newsletter.unsubscribe.invalidTitle')">
          <i18n-t v-if="contactEmail" keypath="newsletter.unsubscribe.invalidLead" scope="global">
            <template #email><a :href="`mailto:${contactEmail}`" class="myc-inline">{{ contactEmail }}</a></template>
          </i18n-t>
          <template v-else>{{ t('newsletter.unsubscribe.invalidLeadNoContact') }}</template>
        </AccountHeading>
        <div>
          <MycButton :href="localizePath('/blog')" variant="secondary">{{ t('newsletter.unsubscribe.blog') }}</MycButton>
        </div>
      </div>
      <form v-else class="myc-account-view" @submit.prevent="unsubscribe">
        <AccountHeading :eyebrow="t('newsletter.unsubscribe.eyebrow')" :title="t('newsletter.unsubscribe.title')">
          {{ t('newsletter.unsubscribe.lead') }}
        </AccountHeading>
        <AccountNotice v-if="error" ref="errorRef" tone="error">{{ error }}</AccountNotice>
        <div>
          <MycButton type="submit">{{ t('newsletter.unsubscribe.submit') }}</MycButton>
        </div>
      </form>
    </div>
  </div>
</template>
