<script setup lang="ts">
import type { NewsletterStatus } from '~/interfaces'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  eyebrow?: string
  placeholder?: string
  buttonLabel?: string
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
  status: 'idle',
  message: undefined,
  id: 'bd-news-email',
  hideHeading: false,
})

const emit = defineEmits<{
  subscribed: [email: string]
}>()

const { t } = useI18n()
const { subscribe } = useNewsletter()
const { isStatic } = useStaticSite()
// The ternary is folded by __STATIC_BUILD__, so dynamic builds ship neither the call nor the chunk (docs/performance.md)
const StaticForm = __STATIC_BUILD__ ? defineAsyncComponent(() => import('./BdNewsletterStatic.vue')) : undefined

const email = ref('')
const submitting = ref(false)
const currentStatus = ref<NewsletterStatus>(props.status)
const feedback = ref<string>(props.message ?? '')
const invalid = ref(props.status === 'error')

const messageId = computed<string>(() => `${props.id}-msg`)
const titleText = computed<string>(() => props.title ?? t('bd.newsletter.title'))
const descriptionText = computed<string>(() => props.description ?? t('bd.newsletter.description'))
const eyebrowText = computed<string>(() => props.eyebrow ?? t('bd.newsletter.eyebrow'))
const placeholderText = computed<string>(() => props.placeholder ?? t('bd.newsletter.placeholder'))
const buttonText = computed<string>(() => props.buttonLabel ?? t('bd.newsletter.button'))

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  const submitted = email.value
  const result = await subscribe(submitted)
  currentStatus.value = result.status
  feedback.value = result.message
  invalid.value = result.invalid
  submitting.value = false
  if (result.status === 'success') {
    email.value = ''
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
  />
  <form v-else class="bd-news" novalidate :aria-busy="submitting" @submit.prevent="handleSubmit">
    <span v-if="!hideHeading" class="bd-eyebrow bd-news-eyebrow">{{ eyebrowText }}</span>
    <h3 v-if="!hideHeading">{{ titleText }}</h3>
    <p v-if="!hideHeading || description">{{ descriptionText }}</p>
    <label :for="id" class="bd-eyebrow bd-news-label">{{ t('bd.newsletter.label') }}</label>
    <div class="bd-news-row">
      <input
        :id="id"
        v-model="email"
        class="bd-input"
        type="email"
        name="email"
        autocomplete="email"
        required
        :placeholder="placeholderText"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-describedby="feedback ? messageId : undefined"
        :disabled="submitting"
      >
      <BdButton type="submit" variant="accent" arrow :disabled="submitting">
        {{ buttonText }}
      </BdButton>
    </div>
    <p
      :id="messageId"
      role="status"
      aria-live="polite"
      :class="['bd-news-msg', { 'bd-news-msg-success': currentStatus === 'success', 'bd-news-msg-error': currentStatus === 'error' }]"
    >{{ feedback }}</p>
  </form>
</template>
