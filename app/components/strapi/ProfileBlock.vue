<script setup lang="ts">
import { images } from '#micelio/theme'
import type { StrapiProfile } from '~/interfaces'

const props = defineProps<{
  block: StrapiProfile
}>()

const themeMessage = useThemeMessage()
const { getMediaUrl } = useStrapi()
const { localizePath } = useLocaleUtils()
const config = useRuntimeConfig()

const photoUrl = computed<string>(() => (props.block.photo?.url ? getMediaUrl(props.block.photo.url) : ''))
const fediverseLink = computed<string>(() => `${localizePath('/')}#fediverso`)

function isFediverseHandle(value: string): boolean {
  return value.trim() === config.public.fediverseHandle
}
</script>

<template>
  <section class="bd-profile">
    <div class="bd-profile-copy">
      <p v-if="block.eyebrow" class="bd-eyebrow bd-home-eyebrow">{{ block.eyebrow }}</p>
      <h1 class="bd-profile-title bd-wide">{{ block.title }}</h1>
      <p v-if="block.lead" class="bd-profile-lead">{{ block.lead }}</p>
    </div>

    <figure class="bd-plate-figure">
      <div class="bd-plate">
        <span class="bd-corner bd-corner-tl" aria-hidden="true" />
        <span class="bd-corner bd-corner-br" aria-hidden="true" />
        <span v-if="block.plateLabel" class="bd-meta bd-plate-label">{{ block.plateLabel }}</span>
        <span v-if="block.plateCoordinates" class="bd-meta bd-plate-coords">{{ block.plateCoordinates }}</span>
        <NuxtImg
          v-if="photoUrl"
          :src="photoUrl"
          :alt="block.photo?.alternativeText || block.title"
          class="bd-plate-photo"
          width="480"
          height="440"
          format="webp"
          loading="eager"
          fetchpriority="high"
        />
        <img
          v-else-if="images.profile"
          :src="images.profile"
          :alt="themeMessage('profile.alt')"
          class="bd-plate-mascot"
          width="586"
          height="433"
          decoding="async"
        >
      </div>
      <figcaption v-if="block.caption" class="bd-meta bd-plate-caption">{{ block.caption }}</figcaption>
    </figure>

    <dl v-if="block.facts?.length" class="bd-facts bd-profile-facts">
      <template v-for="fact in block.facts" :key="fact.id">
        <dt>{{ fact.label }}</dt>
        <dd :class="{ 'font-mono': fact.mono }">
          <NuxtLink v-if="isFediverseHandle(fact.value)" :to="fediverseLink" class="bd-facts-link">{{ fact.value }}</NuxtLink>
          <template v-else>{{ fact.value }}</template>
        </dd>
      </template>
    </dl>

    <div v-if="block.links?.length" class="bd-profile-actions">
      <StrapiLinkButton v-for="link in block.links" :key="link.id" :link="link" />
    </div>
  </section>
</template>
