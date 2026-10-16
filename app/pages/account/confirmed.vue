<script setup lang="ts">
import { authErrorCodeOf, isEmailConfirmationToken } from '~/helpers/auth'

const { t } = useI18n()
const route = useRoute()
const { localizePath } = useLocaleUtils()
const { errorMessage } = useAccountPage(() => t('account.meta.confirmed'))

// Without a token the CMS already confirmed (the legacy GET redirect), so the page only says so
const token = typeof route.query.confirmation === 'string' ? route.query.confirmation : ''
const hasToken = 'confirmation' in route.query
useForgetQueryParam('confirmation')

// Opening the link only shows the button: the email is confirmed by the click, so a scanner that fetches the link confirms nothing
const status = ref<'ready' | 'loading' | 'confirmed' | 'error'>(!hasToken ? 'confirmed' : isEmailConfirmationToken(token) ? 'ready' : 'error')
const error = ref(status.value === 'error' ? t('account.confirmed.invalidToken') : '')
const headingRef = ref<{ focus: () => void }>()
const errorRef = ref<{ focus: () => void }>()

async function confirmEmail(): Promise<void> {
  if (status.value !== 'ready') return
  status.value = 'loading'
  try {
    await $fetch('/api/auth/confirm-email', { method: 'POST', body: { confirmation: token } })
    status.value = 'confirmed'
    await nextTick()
    headingRef.value?.focus()
  } catch (err: unknown) {
    status.value = 'error'
    const code = authErrorCodeOf(err)
    error.value = code === 'invalidCode' || code === 'invalidInput' ? t('account.confirmed.invalidToken') : code === 'tooManyRequests' ? errorMessage(err) : t('account.confirmed.serverError')
    await nextTick()
    errorRef.value?.focus()
  }
}
</script>

<template>
  <AccountShell>
    <form v-if="status === 'ready' || status === 'loading'" class="myc-account-view" data-status="ready" @submit.prevent="confirmEmail">
      <AccountHeading :eyebrow="t('account.eyebrow.confirmed')" :title="t('account.confirmed.readyTitle')">
        {{ t('account.confirmed.readyLead') }}
      </AccountHeading>
      <div>
        <MycButton type="submit" arrow>{{ status === 'loading' ? t('common.loading') : t('account.confirmed.action') }}</MycButton>
      </div>
    </form>

    <div v-else-if="status === 'error'" class="myc-account-view" data-status="error">
      <AccountHeading :eyebrow="t('account.eyebrow.confirmed')" :title="t('account.confirmed.readyTitle')" />
      <AccountNotice ref="errorRef" tone="error">{{ error }}</AccountNotice>
      <div>
        <MycButton :href="localizePath('/account/sign-in')" variant="secondary">{{ t('account.confirmed.signIn') }}</MycButton>
      </div>
    </div>

    <div v-else class="myc-account-view" data-status="confirmed">
      <div class="myc-account-icon">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><circle cx="28" cy="28" r="22" /><path d="M18 28 L25 35 L39 21" stroke-linecap="square" /></svg>
      </div>
      <AccountHeading ref="headingRef" :eyebrow="t('account.eyebrow.confirmed')" :title="t('account.confirmed.title')">
        {{ t('account.confirmed.lead') }}
      </AccountHeading>
      <div>
        <MycButton :href="localizePath('/account/sign-in')" arrow>{{ t('account.confirmed.signIn') }}</MycButton>
      </div>
    </div>
  </AccountShell>
</template>
