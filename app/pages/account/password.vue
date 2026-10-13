<script setup lang="ts">
import { authErrorCodeOf, isValidPassword } from '~/helpers/auth'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const { errorMessage } = useAccountPage(() => t('account.meta.password'))

interface FocusTarget {
  focus: () => void
}

const current = ref('')
const password = ref('')
const confirmation = ref('')
const errors = ref<{ current?: string, password?: string, confirmation?: string }>({})
const error = ref('')
const saved = ref(false)
const submitting = ref(false)
const currentRef = ref<FocusTarget>()
const passwordRef = ref<FocusTarget>()
const confirmationRef = ref<FocusTarget>()
const errorRef = ref<FocusTarget>()
const savedRef = ref<FocusTarget>()

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = ''
  saved.value = false
  errors.value = {
    current: current.value ? undefined : t('account.errors.currentRequired'),
    password: !isValidPassword(password.value) ? t('account.errors.password') : password.value === current.value ? t('account.errors.samePassword') : undefined,
    confirmation: confirmation.value === password.value ? undefined : t('account.errors.mismatch'),
  }
  const invalid = errors.value.current ? currentRef : errors.value.password ? passwordRef : errors.value.confirmation ? confirmationRef : null
  if (invalid) {
    await nextTick()
    invalid.value?.focus()
    return
  }
  submitting.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: current.value, password: password.value, passwordConfirmation: confirmation.value },
    })
    current.value = password.value = confirmation.value = ''
    saved.value = true
    await nextTick()
    savedRef.value?.focus()
  } catch (err: unknown) {
    if (authErrorCodeOf(err) === 'wrongPassword') {
      errors.value = { current: t('account.errors.wrongPassword') }
      await nextTick()
      currentRef.value?.focus()
    } else {
      error.value = errorMessage(err)
      await nextTick()
      errorRef.value?.focus()
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AccountShell>
    <form class="myc-account-view" novalidate @submit.prevent="submit">
      <AccountHeading :eyebrow="t('account.eyebrow.password')" :title="t('account.changePassword.title')">
        {{ t('account.changePassword.lead') }}
      </AccountHeading>
      <AccountNotice v-if="saved" ref="savedRef">{{ t('account.changePassword.saved') }}</AccountNotice>
      <AccountNotice v-if="error" ref="errorRef" tone="error">{{ error }}</AccountNotice>
      <AccountPasswordField
        id="myc-current-pw"
        ref="currentRef"
        v-model="current"
        :label="t('account.changePassword.current')"
        autocomplete="current-password"
        :error="errors.current"
      />
      <AccountPasswordField
        id="myc-new-pw"
        ref="passwordRef"
        v-model="password"
        :label="t('account.changePassword.new')"
        autocomplete="new-password"
        :help="t('account.changePassword.newHelp')"
        :error="errors.password"
        meter
      />
      <AccountPasswordField
        id="myc-new-pw2"
        ref="confirmationRef"
        v-model="confirmation"
        :label="t('account.changePassword.confirm')"
        autocomplete="new-password"
        :error="errors.confirmation"
        :toggle="false"
      />
      <div class="myc-account-actions myc-account-actions-start">
        <MycButton type="submit" arrow>{{ t('account.changePassword.submit') }}</MycButton>
        <MycButton :href="localizePath('/account')" variant="secondary">{{ t('account.changePassword.back') }}</MycButton>
      </div>
    </form>
  </AccountShell>
</template>
