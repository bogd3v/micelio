<script setup lang="ts">
import { isValidEmail } from '~/helpers/auth'

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const { forgotPassword } = useAuth()
const { errorMessage } = useAccountPage(() => t('account.meta.recover'))

const email = ref('')
const fieldError = ref('')
const error = ref('')
const sent = ref(false)
const submitting = ref(false)
const emailRef = ref<{ focus: () => void }>()
const errorRef = ref<{ focus: () => void }>()
const noticeRef = ref<{ focus: () => void }>()

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = ''
  sent.value = false
  fieldError.value = isValidEmail(email.value) ? '' : t('account.errors.email')
  if (fieldError.value) {
    await nextTick()
    emailRef.value?.focus()
    return
  }
  submitting.value = true
  try {
    await forgotPassword(email.value.trim())
    sent.value = true
    await nextTick()
    noticeRef.value?.focus()
  } catch (err: unknown) {
    error.value = errorMessage(err)
    await nextTick()
    errorRef.value?.focus()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AccountShell>
    <form class="myc-account-view" novalidate @submit.prevent="submit">
      <AccountHeading :eyebrow="t('account.eyebrow.recover')" :title="t('account.recover.title')">
        {{ t('account.recover.lead') }}
      </AccountHeading>
      <AccountNotice v-if="sent" ref="noticeRef">{{ t('account.recover.sent') }}</AccountNotice>
      <AccountNotice v-if="error" ref="errorRef" tone="error">{{ error }}</AccountNotice>
      <AccountField
        id="myc-rec-mail"
        ref="emailRef"
        v-model="email"
        type="email"
        :label="t('account.recover.email')"
        autocomplete="email"
        :error="fieldError"
      />
      <div class="myc-account-actions">
        <BdButton type="submit" arrow>{{ t('account.recover.submit') }}</BdButton>
      </div>
      <p class="myc-account-switch">
        <NuxtLink :to="localizePath('/account/sign-in')" class="myc-inline">{{ t('account.recover.back') }}</NuxtLink>
      </p>
    </form>
  </AccountShell>
</template>
