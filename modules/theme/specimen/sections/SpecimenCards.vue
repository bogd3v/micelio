<script setup lang="ts">
import { FEATURED_POST, POSTS } from '../fixtures'

const { t } = useI18n()
const toPostCard = usePostCard()
</script>

<template>
  <div class="myc-specimen-stack">
    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.cards.featured') }}</h3>
      <MycPostCard v-bind="toPostCard(FEATURED_POST)" featured />
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.cards.default') }}</h3>
      <div class="myc-specimen-grid">
        <MycPostCard v-for="post in POSTS" :key="post.id" v-bind="toPostCard(post)" />
      </div>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.cards.variants') }}</h3>
      <div class="myc-specimen-grid">
        <MycPostCard v-bind="toPostCard(POSTS[1]!)" read />
        <MycPostCard v-bind="toPostCard(POSTS[2]!)" :highlight="t('specimen.cards.query')" :snippet="t('specimen.cards.snippet')" />
        <MycPostCard :title="t('specimen.cards.minimal')" href="#cards" />
      </div>
    </div>
  </div>
</template>
