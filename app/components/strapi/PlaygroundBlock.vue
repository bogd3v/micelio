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
const setup = computed<string>(() => playgroundText(props.block.setup))
const caption = computed<string>(() => props.block.caption?.trim() ?? '')
</script>

<template>
  <figure
    class="bd-playground not-prose"
    :data-runtime="runnable ? block.runtime : undefined"
    :aria-label="t('bd.playground.label', { language })"
    :aria-describedby="caption ? `${id}-caption` : undefined"
    :data-playground-setup="runnable && setup ? setup : undefined"
  >
    <BdCodeBlock :code="block.code" :lang="block.runtime" :code-attrs="{ 'data-playground-code': '' }" />
    <figure v-if="expected" class="bd-playground-expected">
      <figcaption class="bd-playground-label">{{ t('bd.playground.expectedOutput') }}</figcaption>
      <pre class="bd-playground-output" tabindex="0">{{ expected }}</pre>
    </figure>
    <template v-if="runnable">
      <div class="bd-playground-actions">
        <BdButton size="sm" :aria-label="t('bd.playground.runAria')" :aria-controls="`${id}-result`" hidden data-playground-run>{{ t('bd.playground.run') }}</BdButton>
      </div>
      <output :id="`${id}-result`" class="bd-playground-result" data-playground-result />
    </template>
    <figcaption v-if="caption" :id="`${id}-caption`" class="bd-playground-caption">{{ caption }}</figcaption>
  </figure>
</template>
