<script setup lang="ts">
import type { StrapiContact } from '~/interfaces'
import { resolveLink } from '~/helpers/links'

const props = defineProps<{
  block: StrapiContact
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()

const fediverseLink = computed(() =>
  props.block.fediverseLink ? resolveLink(props.block.fediverseLink.url, localizePath) : null,
)
const extraLink = computed(() =>
  props.block.extraLink ? resolveLink(props.block.extraLink.url, localizePath) : null,
)
</script>

<template>
  <section class="myc-home-section myc-contact-section myc-reveal" :aria-label="block.title || block.eyebrow || undefined">
    <div class="myc-contact-intro">
      <p v-if="block.eyebrow" class="myc-eyebrow myc-home-eyebrow">{{ block.eyebrow }}</p>
      <h2 v-if="block.title" class="myc-contact-title myc-wide">{{ block.title }}</h2>
      <div v-if="block.fediverseHandle" class="myc-contact-fedi">
        <span v-if="block.fediverseLabel" class="myc-eyebrow myc-contact-fedi-label">{{ block.fediverseLabel }}</span>
        <span class="font-mono myc-contact-fedi-handle">{{ block.fediverseHandle }}</span>
        <NuxtLink
          v-if="block.fediverseLink && fediverseLink"
          :to="fediverseLink.href"
          class="myc-author-card-link"
          :target="fediverseLink.external ? '_blank' : undefined"
          :rel="fediverseLink.external ? 'noopener noreferrer' : undefined"
        >
          {{ block.fediverseLink.label }} <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>
      <NuxtLink
        v-if="block.extraLink && extraLink"
        :to="extraLink.href"
        class="myc-share-link"
        :target="extraLink.external ? '_blank' : undefined"
        :rel="extraLink.external ? 'noopener noreferrer' : undefined"
      >
        {{ block.extraLink.label }} <span v-if="extraLink.external" aria-hidden="true">↗</span>
      </NuxtLink>
    </div>
    <nav v-if="block.socials?.length" class="myc-contact-list" :aria-label="t('bd.footer.social')">
      <a
        v-for="social in block.socials"
        :key="social.id"
        :href="social.url"
        class="myc-contact-row"
        target="_blank"
        rel="noopener noreferrer me"
      >
        <span class="myc-eyebrow myc-home-eyebrow">{{ social.network }}</span>
        <span class="myc-contact-handle">{{ social.handle }}</span>
        <span class="myc-contact-arrow" aria-hidden="true">↗</span>
      </a>
    </nav>
  </section>
</template>
