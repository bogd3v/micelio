<script setup lang="ts">
import { authNotice, safeRedirect } from '~/helpers/auth'

const { t } = useI18n()
const route = useRoute()
const { localizePath } = useLocaleUtils()
const site = useSite()
const { login, ensure } = useAuth()
const { errorMessage } = useAccountPage(() => t('account.meta.signIn'))

const identifier = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)
const errorRef = ref<{ focus: () => void }>()

const notice = computed(() => authNotice(route.query.notice))
const redirect = computed<string>(() => safeRedirect(route.query.redirect) ?? localizePath('/account'))

async function showError(message: string): Promise<void> {
  error.value = message
  await nextTick()
  errorRef.value?.focus()
}

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = ''
  if (!identifier.value.trim() || !password.value) {
    await showError(t('account.errors.required'))
    return
  }
  submitting.value = true
  try {
    await login({ identifier: identifier.value.trim(), password: password.value })
    await navigateTo(redirect.value)
  } catch (err: unknown) {
    password.value = ''
    await showError(errorMessage(err))
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (await ensure()) await navigateTo(redirect.value, { replace: true })
})
</script>

<template>
  <AccountShell>
    <form class="myc-account-view" novalidate @submit.prevent="submit">
      <AccountHeading :eyebrow="t('account.eyebrow.signIn')" :title="t('account.signIn.title', { site: site.name })">
        {{ t('account.signIn.lead') }}
      </AccountHeading>
      <AccountNotice v-if="notice && !error">{{ t(`account.notices.${notice}`) }}</AccountNotice>
      <AccountNotice v-if="error" id="myc-login-err" ref="errorRef" tone="error">{{ error }}</AccountNotice>
      <AccountField
        id="myc-login-id"
        v-model="identifier"
        :label="t('account.signIn.identifier')"
        autocomplete="username"
      />
      <AccountPasswordField
        id="myc-login-pw"
        v-model="password"
        :label="t('account.signIn.password')"
        autocomplete="current-password"
      />
      <div class="myc-account-actions">
        <BdButton type="submit" arrow>{{ t('account.signIn.submit') }}</BdButton>
        <NuxtLink :to="localizePath('/account/forgot-password')" class="myc-inline">{{ t('account.signIn.forgot') }}</NuxtLink>
      </div>
      <p class="myc-account-switch">
        {{ t('account.signIn.noAccount') }}
        <NuxtLink :to="localizePath('/account/sign-up')" class="myc-inline">{{ t('account.signIn.createAccount') }}</NuxtLink>
      </p>
    </form>
  </AccountShell>
</template>
