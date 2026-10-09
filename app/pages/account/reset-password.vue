<script setup lang="ts">
import { authErrorCodeOf, isValidPassword } from '~/helpers/auth'

const { t } = useI18n()
const route = useRoute()
const { localizePath } = useLocaleUtils()
const { resetPassword } = useAuth()
const { errorMessage } = useAccountPage(() => t('account.meta.reset'))

const password = ref('')
const confirmation = ref('')
const errors = ref<{ password?: string, confirmation?: string }>({})
const error = ref('')
const codeExpired = ref(false)
const submitting = ref(false)
const passwordRef = ref<{ focus: () => void }>()
const confirmationRef = ref<{ focus: () => void }>()
const errorRef = ref<{ focus: () => void }>()

const code = computed<string>(() => {
  const value = route.query.code
  return typeof value === 'string' ? value : ''
})

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = ''
  errors.value = {
    password: isValidPassword(password.value) ? undefined : t('account.errors.password'),
    confirmation: confirmation.value === password.value ? undefined : t('account.errors.mismatch'),
  }
  if (errors.value.password || errors.value.confirmation) {
    await nextTick()
    ;(errors.value.password ? passwordRef : confirmationRef).value?.focus()
    return
  }
  submitting.value = true
  try {
    await resetPassword({ code: code.value, password: password.value, passwordConfirmation: confirmation.value })
    await navigateTo({ path: localizePath('/account/sign-in'), query: { notice: 'password-reset' } })
  } catch (err: unknown) {
    error.value = errorMessage(err)
    codeExpired.value = authErrorCodeOf(err) === 'invalidCode'
    await nextTick()
    errorRef.value?.focus()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AccountShell>
    <div v-if="!code" class="myc-account-view">
      <AccountHeading :eyebrow="t('account.eyebrow.reset')" :title="t('account.reset.title')" />
      <AccountNotice tone="error">{{ t('account.reset.missingCode') }}</AccountNotice>
      <div>
        <BdButton :href="localizePath('/account/forgot-password')" variant="secondary">{{ t('account.reset.requestNew') }}</BdButton>
      </div>
    </div>
    <form v-else class="myc-account-view" novalidate @submit.prevent="submit">
      <AccountHeading :eyebrow="t('account.eyebrow.reset')" :title="t('account.reset.title')">
        {{ t('account.reset.lead') }}
      </AccountHeading>
      <AccountNotice v-if="error" ref="errorRef" tone="error">
        {{ error }}
        <NuxtLink v-if="codeExpired" :to="localizePath('/account/forgot-password')">{{ t('account.reset.requestNew') }}</NuxtLink>
      </AccountNotice>
      <AccountPasswordField
        id="myc-new-pw"
        ref="passwordRef"
        v-model="password"
        :label="t('account.reset.password')"
        autocomplete="new-password"
        :help="t('account.reset.passwordHelp')"
        :error="errors.password"
        meter
      />
      <AccountPasswordField
        id="myc-new-pw2"
        ref="confirmationRef"
        v-model="confirmation"
        :label="t('account.reset.confirm')"
        autocomplete="new-password"
        :error="errors.confirmation"
        :toggle="false"
      />
      <div>
        <BdButton type="submit" arrow>{{ t('account.reset.submit') }}</BdButton>
      </div>
    </form>
  </AccountShell>
</template>
