<script setup lang="ts">
import type { StrapiPlayground } from '~/interfaces'
import downloads from '#build/micelio/island-downloads'
import { isRunnable, playgroundLanguage, playgroundText } from '~/helpers/playground'
import { formatDownload } from '~/helpers/playgroundRunner'

// Server markup of a runnable code block. `app/islands/loader.ts` shows the Run button and imports `app/islands/playground.ts` when it
// is pressed (ADR 0006, section 6). The element holds every string the island shows, so the island has none of its own. A block it
// cannot run is a plain code block.
const props = defineProps<{
  block: StrapiPlayground
}>()

const { t } = useI18n()
const id = useId()

if (isRunnable(props.block)) useHeavyIsland('playground')

const language = computed<string>(() => playgroundLanguage(props.block.runtime))
const runnable = computed<boolean>(() => isRunnable(props.block))
const expected = computed<string>(() => playgroundText(props.block.expectedOutput))
const setup = computed<string>(() => playgroundText(props.block.setup))
const download = computed<string>(() => (runnable.value && downloads[props.block.runtime] ? formatDownload(downloads[props.block.runtime]!) : ''))
const caption = computed<string>(() => props.block.caption?.trim() ?? '')
// `{…}` placeholders stay in the text: the island fills them
const placeholders = { size: '{size}', seconds: '{seconds}', message: '{message}', lines: '{lines}' }

// Only a runnable block carries them
const labels = computed<Record<string, string | undefined>>(() => runnable.value
  ? {
      'data-save-data-label': download.value ? t('myc.playground.runSize', { size: download.value }) : undefined,
      'data-save-data-aria': download.value ? t('myc.playground.runSizeAria', { size: download.value }) : undefined,
      'data-queued': t('myc.playground.queued'),
      'data-status-done': t('myc.playground.statusDone', { lines: placeholders.lines }),
      'data-loading': t('myc.playground.loading'),
      'data-running': t('myc.playground.running'),
      'data-empty': t('myc.playground.empty'),
      'data-error': t('myc.playground.error', { message: placeholders.message }),
      'data-timeout': t('myc.playground.timeout', { seconds: placeholders.seconds }),
      'data-stopped': t('myc.playground.stopped'),
      'data-truncated': t('myc.playground.truncated', { size: placeholders.size }),
      'data-unavailable': t('myc.playground.unavailable'),
    }
  : {})
</script>

<template>
  <component :is="runnable ? 'micelio-playground' : 'div'" v-bind="labels">
    <figure
      class="myc-playground not-prose"
      :data-runtime="runnable ? block.runtime : undefined"
      :aria-label="t('myc.playground.label', { language })"
      :aria-describedby="caption ? `${id}-caption` : undefined"
      :data-playground-setup="runnable && setup ? setup : undefined"
    >
      <MycCodeBlock :code="block.code" :lang="block.runtime" :code-attrs="{ 'data-playground-code': '' }" />
      <figure v-if="expected" class="myc-playground-expected">
        <figcaption class="myc-playground-label">{{ t('myc.playground.expectedOutput') }}</figcaption>
        <pre class="myc-playground-output" tabindex="0">{{ expected }}</pre>
      </figure>
      <template v-if="runnable">
        <div class="myc-playground-actions">
          <MycButton size="sm" :aria-label="t('myc.playground.runAria')" :aria-controls="`${id}-result`" hidden data-playground-run>{{ t('myc.playground.run') }}</MycButton>
          <MycButton size="sm" variant="secondary" :aria-label="t('myc.playground.stopAria')" :aria-controls="`${id}-result`" hidden data-playground-stop>{{ t('myc.playground.stop') }}</MycButton>
        </div>
        <p class="myc-playground-notice" role="alert">{{ t('myc.playground.unavailable') }}</p>
        <output :id="`${id}-result`" class="myc-playground-result" data-playground-result />
        <p class="myc-sr" role="status" data-playground-status />
      </template>
      <figcaption v-if="caption" :id="`${id}-caption`" class="myc-playground-caption">{{ caption }}</figcaption>
    </figure>
  </component>
</template>
