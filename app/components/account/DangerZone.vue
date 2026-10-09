<script setup lang="ts">
const props = defineProps<{
  username: string
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const { deleteAccount } = useAuth()
const errorMessage = useAuthErrorMessage()

const open = ref(false)
const confirmText = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)
const confirmRef = ref<{ focus: () => void }>()
const passwordRef = ref<{ focus: () => void }>()
const openRef = ref<HTMLButtonElement>()

const canSubmit = computed<boolean>(() => confirmText.value === props.username && password.value.length > 0 && !submitting.value)

async function show(): Promise<void> {
  open.value = true
  await nextTick()
  confirmRef.value?.focus()
}

async function cancel(): Promise<void> {
  open.value = false
  confirmText.value = ''
  password.value = ''
  error.value = ''
  await nextTick()
  openRef.value?.focus()
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  error.value = ''
  submitting.value = true
  try {
    await deleteAccount({ username: confirmText.value, password: password.value })
    await navigateTo({ path: localizePath('/account/sign-in'), query: { notice: 'account-deleted' } })
  } catch (err: unknown) {
    password.value = ''
    error.value = errorMessage(err)
    await nextTick()
    passwordRef.value?.focus()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="myc-danger" aria-labelledby="myc-del-t">
    <div class="myc-danger-head">
      <span class="myc-danger-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20 H17 L18 7 M10 11 V16 M14 11 V16" /></svg>
      </span>
      <div>
        <h2 id="myc-del-t" class="myc-danger-title">{{ t('account.delete.title') }}</h2>
        <p class="myc-danger-lead">{{ t('account.delete.lead') }}</p>
      </div>
    </div>
    <div v-if="!open">
      <button
        ref="openRef"
        type="button"
        class="myc-btn myc-btn-secondary myc-danger-open"
        aria-expanded="false"
        aria-controls="myc-del-form"
        @click="show"
      >
        {{ t('account.delete.open') }}
      </button>
    </div>
    <form v-else id="myc-del-form" class="myc-danger-form" novalidate @submit.prevent="submit">
      <AccountField
        id="myc-del-in"
        ref="confirmRef"
        v-model="confirmText"
        autocomplete="off"
      >
        <template #label>
          <i18n-t keypath="account.delete.confirmUsername" scope="global">
            <template #username><span class="myc-account-mono">{{ username }}</span></template>
          </i18n-t>
        </template>
      </AccountField>
      <AccountPasswordField
        id="myc-del-pw"
        ref="passwordRef"
        v-model="password"
        :label="t('account.delete.password')"
        autocomplete="current-password"
        :error="error"
        :toggle="false"
      />
      <div class="myc-account-actions myc-account-actions-start">
        <button type="submit" class="myc-btn myc-btn-danger" :disabled="!canSubmit">{{ t('account.delete.submit') }}</button>
        <MycButton variant="secondary" @click="cancel">{{ t('account.delete.cancel') }}</MycButton>
      </div>
    </form>
  </section>
</template>
