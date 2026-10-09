<script setup lang="ts">
import { isValidEmail, isValidPassword, isValidUsername, maskEmail } from '~/helpers/auth'

type RegisterField = 'username' | 'email' | 'password' | 'privacy'

interface FocusTarget {
  focus: () => void
}

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()
const { register, resendConfirmation } = useAuth()

const username = ref('')
const email = ref('')
const password = ref('')
const acceptPrivacy = ref(false)
const errors = ref<Partial<Record<RegisterField, string>>>({})
const error = ref('')
const notice = ref('')
const sentTo = ref('')
const submitting = ref(false)
const usernameRef = ref<FocusTarget>()
const emailRef = ref<FocusTarget>()
const passwordRef = ref<FocusTarget>()
const privacyRef = ref<HTMLInputElement>()
const errorRef = ref<FocusTarget>()
const headingRef = ref<FocusTarget>()

const { errorMessage } = useAccountPage(() => sentTo.value ? t('account.meta.checkEmail') : t('account.meta.register'))

function validate(): Partial<Record<RegisterField, string>> {
  const found: Partial<Record<RegisterField, string>> = {}
  if (!isValidUsername(username.value)) found.username = t('account.errors.username')
  if (!isValidEmail(email.value)) found.email = t('account.errors.email')
  if (!isValidPassword(password.value)) found.password = t('account.errors.password')
  if (!acceptPrivacy.value) found.privacy = t('account.errors.privacy')
  return found
}

async function focusFirstInvalid(): Promise<void> {
  await nextTick()
  const targets: [RegisterField, FocusTarget | undefined][] = [
    ['username', usernameRef.value],
    ['email', emailRef.value],
    ['password', passwordRef.value],
    ['privacy', privacyRef.value],
  ]
  targets.find(([field]) => errors.value[field])?.[1]?.focus()
}

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = ''
  errors.value = validate()
  if (Object.keys(errors.value).length) {
    await focusFirstInvalid()
    return
  }
  submitting.value = true
  try {
    await register({
      username: username.value.trim(),
      email: email.value.trim(),
      password: password.value,
      acceptPrivacy: acceptPrivacy.value,
    })
    sentTo.value = email.value.trim()
    password.value = ''
    await nextTick()
    headingRef.value?.focus()
  } catch (err: unknown) {
    error.value = errorMessage(err)
    await nextTick()
    errorRef.value?.focus()
  } finally {
    submitting.value = false
  }
}

async function resend(): Promise<void> {
  error.value = ''
  notice.value = ''
  try {
    await resendConfirmation(sentTo.value)
    notice.value = t('account.checkEmail.resent')
  } catch (err: unknown) {
    error.value = errorMessage(err)
    await nextTick()
    errorRef.value?.focus()
  }
}
</script>

<template>
  <AccountShell>
    <div v-if="sentTo" class="myc-account-view">
      <div class="myc-account-icon">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><rect x="6" y="14" width="44" height="30" /><path d="M6 14 L28 32 L50 14" /><path d="M40 6 Q46 2 52 6" stroke-linecap="round" /></svg>
      </div>
      <AccountHeading ref="headingRef" :eyebrow="t('account.eyebrow.checkEmail')" :title="t('account.checkEmail.title')">
        <i18n-t keypath="account.checkEmail.lead" scope="global">
          <template #email><strong>{{ maskEmail(sentTo) }}</strong></template>
        </i18n-t>
      </AccountHeading>
      <AccountNotice v-if="notice">{{ notice }}</AccountNotice>
      <AccountNotice v-if="error" ref="errorRef" tone="error">{{ error }}</AccountNotice>
      <p class="myc-account-text">{{ t('account.checkEmail.notArrived') }}</p>
      <div class="myc-account-actions myc-account-actions-start">
        <MycButton variant="secondary" @click="resend">{{ t('account.checkEmail.resend') }}</MycButton>
      </div>
    </div>
    <form v-else class="myc-account-view" novalidate @submit.prevent="submit">
      <AccountHeading :eyebrow="t('account.eyebrow.register')" :title="t('account.register.title')">
        {{ t('account.register.lead') }}
      </AccountHeading>
      <AccountNotice v-if="error" ref="errorRef" tone="error">{{ error }}</AccountNotice>
      <AccountField
        id="myc-reg-user"
        ref="usernameRef"
        v-model="username"
        :label="t('account.register.username')"
        autocomplete="username"
        :help="t('account.register.usernameHelp')"
        :error="errors.username"
      />
      <AccountField
        id="myc-reg-mail"
        ref="emailRef"
        v-model="email"
        type="email"
        :label="t('account.register.email')"
        autocomplete="email"
        :error="errors.email"
      />
      <AccountPasswordField
        id="myc-reg-pw"
        ref="passwordRef"
        v-model="password"
        :label="t('account.register.password')"
        autocomplete="new-password"
        :help="t('account.register.passwordHelp')"
        :error="errors.password"
        meter
      />
      <div class="myc-form-row">
        <label class="myc-check">
          <input
            ref="privacyRef"
            v-model="acceptPrivacy"
            type="checkbox"
            :aria-invalid="errors.privacy ? 'true' : undefined"
            :aria-describedby="errors.privacy ? 'myc-reg-terms-err' : undefined"
          >
          <i18n-t keypath="account.register.privacy" tag="span" scope="global">
            <template #site>{{ site.name }}</template>
            <template #link><NuxtLink :to="localizePath('/privacy')">{{ t('account.register.privacyLink') }}</NuxtLink></template>
          </i18n-t>
        </label>
        <span v-if="errors.privacy" id="myc-reg-terms-err" class="myc-err" role="alert"><span aria-hidden="true">✕</span>{{ errors.privacy }}</span>
      </div>
      <div>
        <MycButton type="submit" arrow>{{ t('account.register.submit') }}</MycButton>
      </div>
      <p class="myc-account-switch">
        {{ t('account.register.hasAccount') }}
        <NuxtLink :to="localizePath('/account/sign-in')" class="myc-inline">{{ t('account.register.signIn') }}</NuxtLink>
      </p>
    </form>
  </AccountShell>
</template>
