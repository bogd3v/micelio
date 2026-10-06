<script setup lang="ts">
import { layout } from '#micelio/theme'
import { variants as alternates } from '#micelio/specimen-variants'
import type { Category, FieldGuideTopic } from '~/interfaces'
import { CATEGORIES } from '~/helpers/categories'
import { ARTICLE, FEATURED_POST, POSTS } from '../fixtures'

const { t } = useI18n()

// Headers and footers the theme does not use; the specimen registers them under their own names
const chrome = alternates
  .filter(({ region }) => region === 'header' || region === 'footer')
  .map(({ region, variant, component }) => ({
    region,
    variant,
    component,
    view: resolveComponent(component),
    // A distinct label keeps the copy's navigation apart from the page's own (the columns footer labels its groups by heading)
    props: {
      ...(region === 'header' ? { active: 'blog', reading: false } : {}),
      ...(region === 'header' || variant === 'minimal' ? { label: t('specimen.regions.navLabel', { variant: t(`specimen.regions.variantNames.${variant}`) }) } : {}),
    },
  }))
const regions: Array<[string, string]> = Object.entries(layout)
const counts = Object.fromEntries(CATEGORIES.map((category, index) => [category, index + 1])) as Partial<Record<Category, number>>
const topics: FieldGuideTopic[] = CATEGORIES.map((category, index) => ({ category, count: index + 1 }))
</script>

<template>
  <div class="bd-specimen-stack">
    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.regions.active') }}</h3>
      <dl class="bd-specimen-variants">
        <template v-for="[region, variant] in regions" :key="region">
          <dt>{{ region }}</dt>
          <dd><code>{{ variant }}</code></dd>
        </template>
      </dl>
      <p class="bd-body-s">{{ t('specimen.regions.chrome') }}</p>
    </div>

    <div v-for="{ region, variant, component, view, props } in chrome" :key="component">
      <h3 class="bd-specimen-label">{{ t(`specimen.regions.${region}Variant`, { variant: t(`specimen.regions.variantNames.${variant}`) }) }}</h3>
      <div class="bd-specimen-frame">
        <component :is="view" v-bind="props" />
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.regions.postList') }}</h3>
      <div class="bd-specimen-frame">
        <RegionPostList :posts="POSTS" view="grid" :federated="false" />
      </div>
      <div class="bd-specimen-frame">
        <RegionPostList :posts="POSTS" view="log" :federated="false" />
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.regions.home') }}</h3>
      <div class="bd-specimen-frame">
        <RegionHome :featured-post="FEATURED_POST" :total="POSTS.length" :counts="counts" :topics="topics" />
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.regions.article') }}</h3>
      <div class="bd-specimen-frame">
        <RegionArticle :post="ARTICLE" share-url="https://example.com/blog/specimen" draft />
      </div>
    </div>
  </div>
</template>
