<script setup lang="ts">
const props = withDefaults(defineProps<{
  id: string
  label?: string
  type?: 'text' | 'email'
  autocomplete: string
  help?: string
  error?: string
}>(), {
  label: '',
  type: 'text',
  help: '',
  error: '',
})

const model = defineModel<string>({ required: true })

const inputRef = ref<HTMLInputElement>()

const describedBy = computed<string | undefined>(() => {
  const ids = [props.help && `${props.id}-help`, props.error && `${props.id}-err`].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
})

function focus(): void {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="myc-form-row">
    <label :for="id" class="myc-label"><slot name="label">{{ label }}</slot></label>
    <input
      :id="id"
      ref="inputRef"
      v-model="model"
      class="myc-field"
      :type="type"
      :autocomplete="autocomplete"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      spellcheck="false"
      autocapitalize="none"
    >
    <span v-if="help" :id="`${id}-help`" class="myc-help">{{ help }}</span>
    <span v-if="error" :id="`${id}-err`" class="myc-err" role="alert"><span aria-hidden="true">✕</span>{{ error }}</span>
  </div>
</template>
