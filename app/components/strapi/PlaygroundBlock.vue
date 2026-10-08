<script setup lang="ts">
import type { StrapiPlayground } from '~/interfaces'
import { isRunnable, playgroundLanguage, playgroundText } from '~/helpers/playground'

const props = defineProps<{
  block: StrapiPlayground
}>()

const { t } = useI18n()
const id = useId()

const language = computed<string>(() => playgroundLanguage(props.block.runtime))
const runnable = computed<boolean>(() => isRunnable(props.block))
const expected = computed<string>(() => playgroundText(props.block.expectedOutput))
const caption = computed<string>(() => props.block.caption?.trim() ?? '')
</script>

<template>
  <figure
    class="bd-playground not-prose"
    :data-runtime="runnable ? block.runtime : undefined"
    :aria-label="t('bd.playground.label', { language })"
  >
    <BdCodeBlock :code="block.code" :lang="language" />
    <div v-if="expected">
      <p :id="`${id}-expected`" class="bd-playground-label">{{ t('bd.playground.expectedOutput') }}</p>
      <pre class="bd-playground-output" tabindex="0" :aria-labelledby="`${id}-expected`">{{ expected }}</pre>
    </div>
    <template v-if="runnable">
      <div class="bd-playground-actions">
        <BdButton size="sm" :aria-label="t('bd.playground.runAria')" hidden data-playground-run>{{ t('bd.playground.run') }}</BdButton>
      </div>
      <div class="bd-playground-result" role="region" :aria-label="t('bd.playground.result')" aria-live="polite" data-playground-output />
    </template>
    <figcaption v-if="caption" class="bd-playground-caption">{{ caption }}</figcaption>
  </figure>
</template>
