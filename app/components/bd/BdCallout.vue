<script setup lang="ts">
import type { CalloutTone } from '~/interfaces'
import { CALLOUT_GLYPHS } from '~/helpers/callout'

const props = withDefaults(defineProps<{
  tone?: CalloutTone
  title?: string
}>(), {
  tone: 'note',
  title: undefined,
})

const { t } = useI18n()

const heading = computed<string>(() => props.title ?? t(`bd.callout.${props.tone}`))
</script>

<template>
  <aside
    :class="['myc-callout', `myc-callout-${tone}`]"
    :role="tone === 'danger' ? 'alert' : 'note'"
  >
    <span class="myc-callout-label"><span aria-hidden="true">{{ `${CALLOUT_GLYPHS[tone]} ` }}</span>{{ heading }}</span>
    <div class="myc-callout-body">
      <slot />
    </div>
  </aside>
</template>
