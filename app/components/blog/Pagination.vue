<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { BlogFilters, PaginationItem } from '~/interfaces'
import { blogLocation, paginationItems } from '~/helpers/blog'
import { padCount } from '~/helpers/search'

const props = defineProps<{
  filters: BlogFilters
  totalPages: number
  pageSize: number
}>()

const { t } = useI18n()
const { localizePath } = useLocaleUtils()

const current = computed<number>(() => Math.min(props.filters.page, Math.max(props.totalPages, 1)))
const pageCount = computed<number>(() => Math.max(props.totalPages, 1))
const items = computed<PaginationItem[]>(() => paginationItems(current.value, pageCount.value))
const status = computed<string>(() =>
  t('blog.pagination.status', { page: padCount(current.value), total: padCount(pageCount.value) }),
)

function linkTo(page: number): RouteLocationRaw {
  return blogLocation({ ...props.filters, page }, localizePath('/blog'))
}
</script>

<template>
  <nav class="myc-blog-pagination" :aria-label="t('blog.pagination.label')">
    <NuxtLink
      v-if="current > 1"
      :to="linkTo(current - 1)"
      class="myc-page myc-page-step"
      :aria-label="t('common.ariaPrevPage')"
    >
      ← <span class="myc-page-step-label">{{ t('blog.pagination.previous') }}</span>
    </NuxtLink>
    <span v-else class="myc-page myc-page-step" aria-disabled="true">
      ← <span class="myc-page-step-label">{{ t('blog.pagination.previous') }}</span>
    </span>

    <div class="myc-page-center">
      <ol class="myc-page-list">
        <li v-for="(item, index) in items" :key="index">
          <span v-if="item === 'gap'" class="myc-meta myc-page-gap" aria-hidden="true">…</span>
          <NuxtLink
            v-else
            :to="linkTo(item)"
            class="myc-page"
            :aria-current="item === current ? 'page' : undefined"
            :aria-label="t('blog.pagination.page', { page: item })"
          >
            {{ padCount(item) }}
          </NuxtLink>
        </li>
      </ol>
      <span class="myc-meta myc-page-status">
        {{ status }}<span class="myc-page-size"> · {{ t('blog.pagination.perPage', { count: pageSize }) }}</span>
      </span>
    </div>

    <NuxtLink
      v-if="current < pageCount"
      :to="linkTo(current + 1)"
      class="myc-page myc-page-step"
      :aria-label="t('common.ariaNextPage')"
    >
      <span class="myc-page-step-label">{{ t('blog.pagination.next') }}</span> →
    </NuxtLink>
    <span v-else class="myc-page myc-page-step" aria-disabled="true">
      <span class="myc-page-step-label">{{ t('blog.pagination.next') }}</span> →
    </span>
  </nav>
</template>
