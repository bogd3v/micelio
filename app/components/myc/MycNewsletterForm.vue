<script setup lang="ts">
import type { NewsletterStatus } from '~/interfaces'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  eyebrow?: string
  placeholder?: string
  buttonLabel?: string
  /** The sentence after a subscription; unset or empty is the core's string */
  successMessage?: string
  /** The legal text beside a required checkbox; unset or empty renders neither */
  consentText?: string
  status?: NewsletterStatus
  message?: string
  id?: string
  /** The page already heads the form: no eyebrow and no title */
  hideHeading?: boolean
}>(), {
  title: undefined,
  description: undefined,
  eyebrow: undefined,
  placeholder: undefined,
  buttonLabel: undefined,
  successMessage: undefined,
  consentText: undefined,
  status: 'idle',
  message: undefined,
  id: 'myc-news-email',
  hideHeading: false,
})

const emit = defineEmits<{
  subscribed: [email: string]
}>()

const { t } = useI18n()
const { subscribe } = useNewsletter()
const { isStatic } = useStaticSite()
// The ternary is folded by __STATIC_BUILD__, so dynamic builds ship neither the call nor the chunk (docs/performance.md)
const StaticForm = __STATIC_BUILD__ ? defineAsyncComponent(() => import('./MycNewsletterStatic.vue')) : undefined

const email = ref('')
const submitting = ref(false)
const currentStatus = ref<NewsletterStatus>(props.status)
const feedback = ref<string>(props.message ?? '')
const invalid = ref(props.status === 'error')

const messageId = computed<string>(() => `${props.id}-msg`)
const titleText = computed<string>(() => props.title ?? t('myc.newsletter.title'))
const descriptionText = computed<string>(() => props.description ?? t('myc.newsletter.description'))
const eyebrowText = computed<string>(() => props.eyebrow ?? t('myc.newsletter.eyebrow'))
const placeholderText = computed<string>(() => props.placeholder ?? t('myc.newsletter.placeholder'))
const buttonText = computed<string>(() => props.buttonLabel ?? t('myc.newsletter.button'))
const consent = ref(false)
const consentInvalid = ref(false)

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  if (props.consentText && !consent.value) {
    currentStatus.value = 'error'
    feedback.value = t('myc.newsletter.consentRequired')
    consentInvalid.value = true
    return
  }
  consentInvalid.value = false
  submitting.value = true
  const submitted = email.value
  const result = await subscribe(submitted)
  currentStatus.value = result.status
  feedback.value = result.status === 'success' && props.successMessage ? props.successMessage : result.message
  invalid.value = result.invalid
  submitting.value = false
  if (result.status === 'success') {
    email.value = ''
    consent.value = false
    emit('subscribed', submitted.trim())
  }
}

watch(() => [props.status, props.message] as const, ([status, message]) => {
  currentStatus.value = status
  feedback.value = message ?? ''
  invalid.value = status === 'error'
})
</script>

<template>
  <component
    :is="StaticForm"
    v-if="StaticForm && isStatic"
    :id="id"
    :hide-heading="hideHeading"
    :eyebrow="eyebrowText"
    :title="titleText"
    :description="descriptionText"
    :show-description="!hideHeading || Boolean(description)"
    :placeholder="placeholderText"
    :button-label="buttonText"
    :consent-text="consentText"
  />
  <form v-else class="myc-news" novalidate :aria-busy="submitting" @submit.prevent="handleSubmit">
    <span v-if="!hideHeading" class="myc-eyebrow myc-news-eyebrow">{{ eyebrowText }}</span>
    <h3 v-if="!hideHeading">{{ titleText }}</h3>
    <p v-if="!hideHeading || description">{{ descriptionText }}</p>
    <label :for="id" class="myc-eyebrow myc-news-label">{{ t('myc.newsletter.label') }}</label>
    <div class="myc-news-row">
      <input
        :id="id"
        v-model="email"
        class="myc-input"
        type="email"
        name="email"
        autocomplete="email"
        required
        :placeholder="placeholderText"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-describedby="feedback ? messageId : undefined"
        :disabled="submitting"
      >
      <MycButton type="submit" variant="accent" arrow :disabled="submitting">
        {{ buttonText }}
      </MycButton>
    </div>
    <label v-if="consentText" class="myc-news-consent">
      <input
        v-model="consent"
        type="checkbox"
        name="consent"
        required
        :aria-invalid="consentInvalid ? 'true' : undefined"
        :aria-describedby="feedback ? messageId : undefined"
        :disabled="submitting"
      >
      <span>{{ consentText }}</span>
    </label>
    <p
      :id="messageId"
      role="status"
      aria-live="polite"
      :class="['myc-news-msg', { 'myc-news-msg-success': currentStatus === 'success', 'myc-news-msg-error': currentStatus === 'error' }]"
    >{{ feedback }}</p>
  </form>
</template>
