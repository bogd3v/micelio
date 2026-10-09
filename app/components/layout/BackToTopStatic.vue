<script setup lang="ts">
// Static builds only (no client JS): a link to the top, shown by a scroll timeline (layout/back-to-top.css, #245)
const { t } = useI18n()
</script>

<template>
  <a class="myc-back-to-top" data-static href="#" :aria-label="t('common.backToTop')">
    <IconsChevronUp />
  </a>
</template>
