<script setup lang="ts">
const { t } = useI18n()
const { siteUrl } = useSiteUrl()

const feedCommand = computed<string>(() => `$ curl -s ${siteUrl.value}/feed.xml`)
</script>

<template>
  <section id="newsletter" class="myc-home-section myc-subscribe myc-reveal">
    <MycNewsletterForm id="nl-home" class="myc-subscribe-form" />
    <div class="myc-subscribe-rss">
      <p class="myc-eyebrow myc-home-eyebrow">{{ t('home.rss.title') }}</p>
      <p class="myc-home-intro">{{ t('home.rss.description') }}</p>
      <MycCodeBlock lang="shell" :code="feedCommand" />
    </div>
  </section>
</template>
