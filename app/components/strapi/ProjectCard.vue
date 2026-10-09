<script setup lang="ts">
import type { StrapiProject } from '~/interfaces'

// One swatch per category role, in CATEGORIES order
const SWATCHES: readonly string[] = [1, 2, 3, 4, 5].map(n => `var(--category-${n})`)

defineProps<{
  project: StrapiProject
}>()

const themeMessage = useThemeMessage()
</script>

<template>
  <article :class="['myc-project', { 'myc-project-featured': project.featured }]">
    <template v-if="project.featured">
      <span class="myc-corner myc-corner-tl" aria-hidden="true" />
      <span class="myc-corner myc-corner-br" aria-hidden="true" />
    </template>
    <div class="myc-project-body">
      <p v-if="project.eyebrow || project.meta" class="myc-project-kicker">
        <span v-if="project.eyebrow" class="myc-eyebrow myc-project-eyebrow">{{ project.eyebrow }}</span>
        <span v-if="project.meta" class="myc-meta myc-project-meta">{{ project.meta }}</span>
      </p>
      <h3 class="myc-project-title myc-wide">{{ project.title }}</h3>
      <p v-if="project.description" class="myc-project-text">{{ project.description }}</p>
      <dl v-if="project.facts?.length" class="myc-facts">
        <template v-for="fact in project.facts" :key="fact.id">
          <dt>{{ fact.label }}</dt>
          <dd :class="{ 'font-mono': fact.mono }">{{ fact.value }}</dd>
        </template>
      </dl>
      <ul v-if="project.stack?.length" class="myc-project-stack">
        <li v-for="item in project.stack" :key="item.id" class="myc-stack-chip">{{ item.name }}</li>
      </ul>
      <div v-if="project.visual === 'palette'" class="myc-project-palette">
        <span v-for="token in SWATCHES" :key="token" class="myc-swatch" :style="{ background: token }" aria-hidden="true" />
        <span v-if="themeMessage('palette.names')" class="myc-meta myc-project-meta">{{ themeMessage('palette.names') }}</span>
      </div>
      <div v-if="project.links?.length" class="myc-project-links">
        <StrapiLinkButton v-for="link in project.links" :key="link.id" :link="link" />
      </div>
    </div>
    <div v-if="project.visual === 'fediverse'" class="myc-project-visual">
      <StrapiFediverseDiagram />
      <span v-if="project.visualCaption" class="myc-meta myc-project-meta">{{ project.visualCaption }}</span>
    </div>
  </article>
</template>
