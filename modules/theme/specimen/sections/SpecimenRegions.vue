<script setup lang="ts">
import { layout } from '#micelio/theme'
import type { Category, FieldGuideTopic } from '~/interfaces'
import { CATEGORIES } from '~/helpers/categories'
import { ARTICLE, FEATURED_POST, POSTS } from '../fixtures'

const { t } = useI18n()

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
