<script setup lang="ts">
import type { CreditPart, StrapiImageCredit } from '~/interfaces'
import { creditParts } from '~/helpers/figures'

const props = defineProps<{
  credit: StrapiImageCredit
}>()

const { t, locale } = useI18n()

const parts = computed(() => creditParts(props.credit, locale.value).map(part => ({
  ...part,
  label: partLabel(part),
})))

function partLabel(part: CreditPart): string {
  return part.labelKey ? t(`bd.figure.license.${part.labelKey}`) : part.text ?? ''
}
</script>

<template>
  <span class="myc-credit">
    <span class="myc-credit-k">{{ t(`bd.figure.kind.${credit.kind}`) }}</span>
    <template v-for="(part, index) in parts" :key="part.role">
      <template v-if="index > 0"> · </template>
      <template v-else>{{ ' ' }}</template>
      <a
        v-if="part.href"
        :href="part.href"
        target="_blank"
        :rel="part.role === 'license' ? 'license noopener noreferrer' : 'noopener noreferrer'"
        :aria-label="t('bd.figure.newTab', { label: part.label })"
      >{{ part.label }}</a>
      <template v-else>{{ part.label }}</template>
    </template>
  </span>
</template>
