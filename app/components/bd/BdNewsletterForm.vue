<script setup lang="ts">
import type { NewsletterStatus } from '~/interfaces'
import { formFieldName, hiddenFields, providerHost, validFormAction } from '~/helpers/newsletterForm'
import type { HiddenField } from '~/helpers/newsletterForm'

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
const localizePath = useLocalePath()
const { newsletterFormAction, newsletterFormField } = useRuntimeConfig().public

// Static builds: a plain form post to the provider, no Vue (ADR 0006, section 5)
const providerAction = computed<string>(() => validFormAction(newsletterFormAction))
const providerField = computed<string>(() => formFieldName(newsletterFormField))
const providerName = computed<string>(() => providerHost(providerAction.value))
const providerHidden = computed<HiddenField[]>(() => hiddenFields(providerAction.value))

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
  <!-- No target: without JS a popup cannot open; the provider's confirmation page replaces this one -->
  <form v-if="isStatic" class="bd-news" method="post" :action="providerAction">
    <span v-if="!hideHeading" class="bd-eyebrow bd-news-eyebrow">{{ eyebrowText }}</span>
    <h3 v-if="!hideHeading">{{ titleText }}</h3>
    <p v-if="!hideHeading || description">{{ descriptionText }}</p>
    <label :for="id" class="bd-eyebrow bd-news-label">{{ t('bd.newsletter.label') }}</label>
    <div class="bd-news-row">
      <input :id="id" class="bd-input" type="email" :name="providerField" autocomplete="email" required :placeholder="placeholderText">
      <input v-for="field in providerHidden" :key="field.name" type="hidden" :name="field.name" :value="field.value">
      <BdButton type="submit" variant="accent" arrow>{{ buttonText }}</BdButton>
    </div>
    <i18n-t keypath="bd.newsletter.external" tag="p" scope="global" class="bd-news-note">
      <template #provider><strong>{{ providerName }}</strong></template>
      <template #link><NuxtLink :to="localizePath('/privacy')">{{ t('bd.newsletter.privacyLink') }}</NuxtLink></template>
    </i18n-t>
  </form>
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
