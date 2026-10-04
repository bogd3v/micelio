<script setup lang="ts">
import type { StrapiProject } from '~/interfaces'

// One swatch per category role, in CATEGORIES order
const SWATCHES: readonly string[] = [1, 2, 3, 4, 5].map(n => `var(--category-${n})`)

defineProps<{
  project: StrapiProject
}>()

const { t } = useI18n()
</script>

<template>
  <article :class="['bd-project', { 'bd-project-featured': project.featured }]">
    <template v-if="project.featured">
      <span class="bd-corner bd-corner-tl" aria-hidden="true" />
      <span class="bd-corner bd-corner-br" aria-hidden="true" />
    </template>
    <div class="bd-project-body">
      <p v-if="project.eyebrow || project.meta" class="bd-project-kicker">
        <span v-if="project.eyebrow" class="bd-eyebrow bd-project-eyebrow">{{ project.eyebrow }}</span>
        <span v-if="project.meta" class="bd-meta bd-project-meta">{{ project.meta }}</span>
      </p>
      <h3 class="bd-project-title bd-wide">{{ project.title }}</h3>
      <p v-if="project.description" class="bd-project-text">{{ project.description }}</p>
      <dl v-if="project.facts?.length" class="bd-facts">
        <template v-for="fact in project.facts" :key="fact.id">
          <dt>{{ fact.label }}</dt>
          <dd :class="{ 'font-mono': fact.mono }">{{ fact.value }}</dd>
        </template>
      </dl>
      <ul v-if="project.stack?.length" class="bd-project-stack">
        <li v-for="item in project.stack" :key="item.id" class="bd-stack-chip">{{ item.name }}</li>
      </ul>
      <div v-if="project.visual === 'palette'" class="bd-project-palette">
        <span v-for="token in SWATCHES" :key="token" class="bd-swatch" :style="{ background: token }" aria-hidden="true" />
        <span class="bd-meta bd-project-meta">{{ t('about.palette') }}</span>
      </div>
      <div v-if="project.links?.length" class="bd-project-links">
        <StrapiLinkButton v-for="link in project.links" :key="link.id" :link="link" />
      </div>
    </div>
    <div v-if="project.visual === 'fediverse'" class="bd-project-visual">
      <StrapiFediverseDiagram />
      <span v-if="project.visualCaption" class="bd-meta bd-project-meta">{{ project.visualCaption }}</span>
    </div>
  </article>
</template>
