<script setup lang="ts">
import { dismissPrivacyNotice, isPrivacyNoticeDismissed } from '~/helpers/privacy'

const { t } = useI18n()
const { localizePath } = useLocaleUtils()

const open = ref(false)
const notice = useTemplateRef<HTMLElement>('notice')

function close(): void {
  open.value = false
  dismissPrivacyNotice()
}

// The notice is fixed over the page: its height (and the gap around it) is reserved by `scroll-padding-bottom` while it is shown
const NOTICE_GAP = 24
let observer: ResizeObserver | undefined

watch(notice, (element) => {
  observer?.disconnect()
  const root = document.documentElement
  if (!element) {
    root.style.removeProperty('--myc-notice-h')
    return
  }
  observer = new ResizeObserver(() => root.style.setProperty('--myc-notice-h', `${element.offsetHeight + NOTICE_GAP}px`))
  observer.observe(element)
})

onMounted(() => {
  open.value = !isPrivacyNoticeDismissed()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  document.documentElement.style.removeProperty('--myc-notice-h')
})
</script>

<template>
  <section v-if="open" ref="notice" class="myc-privacy-notice" role="region" :aria-label="t('privacy.notice.label')">
    <p class="myc-privacy-notice-text">
      <span class="myc-privacy-notice-mark" aria-hidden="true">◆ </span>{{ t('privacy.notice.text') }}
      <NuxtLink :to="localizePath('/privacy')">{{ t('privacy.notice.more') }}</NuxtLink>
    </p>
    <MycButton size="sm" class="myc-privacy-notice-ok" @click="close">{{ t('privacy.notice.ok') }}</MycButton>
  </section>
</template>
