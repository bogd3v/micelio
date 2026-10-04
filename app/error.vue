<script setup lang="ts">
import { pageTitle } from '~/helpers/site'

const { locale, t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()

const props = defineProps<{
  error: {
    statusCode?: number
    message?: string
  }
}>()

const handleError = () => clearError({ redirect: '/' })

useHead({
  htmlAttrs: {
    lang: () => locale.value,
  },
})

useSeoMeta({
  title: () => pageTitle(props.error.statusCode === 404 ? t('error.pageNotFound') : t('error.somethingWentWrong'), site.value.name),
  robots: 'noindex',
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="text-center max-w-md">
      <div class="w-32 h-32 mx-auto mb-8 rounded-full gradient-bogota-subtle flex items-center justify-center">
        <span class="text-6xl font-display font-bold text-[var(--primary)]">
          {{ error.statusCode || 404 }}
        </span>
      </div>

      <h1 class="text-3xl font-display font-semibold mb-4">
        {{ error.statusCode === 404 ? t('error.pageNotFound') : t('error.somethingWentWrong') }}
      </h1>

      <p class="text-[var(--muted)] mb-8">
        {{ error.statusCode === 404
          ? t('error.notExist')
          : t('error.unexpected')
        }}
      </p>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <BdButton @click="handleError">
          <UIcon name="i-heroicons-home" class="w-4 h-4" />
          {{ t('error.goHome') }}
        </BdButton>
        <BdButton :href="localizePath('/blog')" variant="secondary">
          <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
          {{ t('error.browseBlog') }}
        </BdButton>
      </div>

      <div class="mt-12 p-4 rounded-lg bg-[var(--surface-elevated)]">
        <p class="text-sm text-[var(--muted)]">
          {{ t('error.contactSupport') }}
        </p>
      </div>
    </div>
  </div>
</template>
