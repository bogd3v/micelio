<script setup lang="ts">
import { dismissPrivacyNotice, isPrivacyNoticeDismissed } from '~/helpers/privacy'

const { t } = useI18n()
const { localizePath } = useLocaleUtils()

const open = ref(false)

function close(): void {
  open.value = false
  dismissPrivacyNotice()
}

onMounted(() => {
  open.value = !isPrivacyNoticeDismissed()
})
</script>

<template>
  <section v-if="open" class="myc-privacy-notice" role="region" :aria-label="t('privacy.notice.label')">
    <p class="myc-privacy-notice-text">
      <span class="myc-privacy-notice-mark" aria-hidden="true">◆ </span>{{ t('privacy.notice.text') }}
      <NuxtLink :to="localizePath('/privacy')">{{ t('privacy.notice.more') }}</NuxtLink>
    </p>
    <MycButton size="sm" class="myc-privacy-notice-ok" @click="close">{{ t('privacy.notice.ok') }}</MycButton>
  </section>
</template>
