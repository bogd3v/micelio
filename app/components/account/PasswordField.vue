<script setup lang="ts">
import type { PasswordStrength } from '~/interfaces'
import { passwordStrength } from '~/helpers/auth'

const STRENGTH_KEYS: Record<PasswordStrength, string> = {
  0: 'empty',
  1: 'short',
  2: 'fair',
  3: 'good',
  4: 'great',
}

const props = withDefaults(defineProps<{
  id: string
  label: string
  autocomplete: 'current-password' | 'new-password'
  help?: string
  error?: string
  meter?: boolean
  toggle?: boolean
}>(), {
  help: '',
  error: '',
  meter: false,
  toggle: true,
})

const model = defineModel<string>({ required: true })

const { t } = useI18n()

const inputRef = ref<HTMLInputElement>()
const shown = ref(false)

const level = computed<PasswordStrength>(() => passwordStrength(model.value))
const describedBy = computed<string | undefined>(() => {
  const ids = [
    props.help && `${props.id}-help`,
    props.meter && `${props.id}-meter`,
    props.error && `${props.id}-err`,
  ].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
})

function focus(): void {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="myc-form-row">
    <label :for="id" class="myc-label">{{ label }}</label>
    <div :class="{ 'myc-field-group': toggle }">
      <input
        :id="id"
        ref="inputRef"
        v-model="model"
        class="myc-field"
        :type="shown ? 'text' : 'password'"
        :autocomplete="autocomplete"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
      >
      <button
        v-if="toggle"
        type="button"
        class="myc-seg"
        :aria-pressed="shown ? 'true' : 'false'"
        :aria-controls="id"
        @click="shown = !shown"
      >
        {{ shown ? t('account.password.hide') : t('account.password.show') }}
      </button>
    </div>
    <div v-if="meter" :id="`${id}-meter`" class="myc-meter" :data-level="level">
      <div class="myc-meter-bars" aria-hidden="true"><span /><span /><span /><span /></div>
      <span class="myc-help">{{ t(`account.password.strength.${STRENGTH_KEYS[level]}`) }}</span>
    </div>
    <span v-if="help" :id="`${id}-help`" class="myc-help">{{ help }}</span>
    <span v-if="error" :id="`${id}-err`" class="myc-err" role="alert"><span aria-hidden="true">✕</span>{{ error }}</span>
  </div>
</template>
