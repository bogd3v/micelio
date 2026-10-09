<script setup lang="ts">
const COPIED_MS = 1600

const props = withDefaults(defineProps<{
  url: string
  variant?: 'button' | 'link'
}>(), {
  variant: 'button',
})

const { t } = useI18n()
const { isStatic } = useStaticSite()
const { copy, copied } = useClipboard({ copiedDuring: COPIED_MS, legacy: true })

const label = computed<string>(() => (copied.value ? t('post.linkCopied') : t('post.copyLink')))

function copyLink(): void {
  copy(props.url)
}
</script>

<template>
  <span v-if="!isStatic" class="myc-copy-link">
    <MycButton v-if="variant === 'button'" variant="secondary" size="sm" @click="copyLink">{{ label }}</MycButton>
    <button v-else type="button" class="myc-share-link" @click="copyLink">{{ label }}</button>
    <span class="myc-sr" aria-live="polite">{{ copied ? t('post.linkCopied') : '' }}</span>
  </span>
</template>
