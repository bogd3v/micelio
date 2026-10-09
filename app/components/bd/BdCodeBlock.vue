<script setup lang="ts">
import type { CodeLine } from '~/interfaces'
import { copyableCode, splitCodeLines } from '~/helpers/code'

const props = withDefaults(defineProps<{
  code: string
  lang?: string
  filename?: string
  showCopy?: boolean
  codeAttrs?: Record<string, string>
}>(), {
  lang: undefined,
  filename: undefined,
  showCopy: true,
  codeAttrs: undefined,
})

const { t } = useI18n()

const copied = ref(false)
const canCopy = ref(false)

const lines = computed<CodeLine[]>(() => splitCodeLines(props.code))

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(copyableCode(lines.value))
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    copied.value = false
  }
}

onMounted(() => {
  canCopy.value = typeof navigator !== 'undefined' && !!navigator.clipboard
})
</script>

<template>
  <figure class="myc-code not-prose">
    <div class="myc-code-head">
      <span v-if="lang" class="myc-code-lang">{{ lang }}</span>
      <span v-if="filename">{{ filename }}</span>
      <button
        v-if="showCopy && canCopy"
        type="button"
        class="myc-code-copy"
        :aria-label="copied ? t('bd.code.copied') : t('bd.code.copyAria')"
        aria-live="polite"
        @click="copy"
      >
        {{ copied ? t('bd.code.copied') : t('bd.code.copy') }}
      </button>
    </div>
    <pre tabindex="0"><code v-bind="codeAttrs" :class="lang ? `language-${lang}` : undefined"><template v-for="(line, index) in lines" :key="index"><span v-if="line.prompt" class="myc-prompt">$ </span>{{ line.text }}<template v-if="index < lines.length - 1">{{ '\n' }}</template></template></code></pre>
  </figure>
</template>
