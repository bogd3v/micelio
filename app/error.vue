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
  <div class="bd-error-page">
    <div class="bd-error-body">
      <div class="bd-error-code gradient-bogota-subtle">
        <span class="bd-error-code-text font-display">
          {{ error.statusCode || 404 }}
        </span>
      </div>

      <h1 class="bd-error-title font-display">
        {{ error.statusCode === 404 ? t('error.pageNotFound') : t('error.somethingWentWrong') }}
      </h1>

      <p class="bd-error-text">
        {{ error.statusCode === 404
          ? t('error.notExist')
          : t('error.unexpected')
        }}
      </p>

      <div class="bd-error-actions">
        <BdButton @click="handleError">
          <IconsHome />
          {{ t('error.goHome') }}
        </BdButton>
        <BdButton :href="localizePath('/blog')" variant="secondary">
          <IconsDocumentText />
          {{ t('error.browseBlog') }}
        </BdButton>
      </div>

      <div class="bd-error-help">
        <p>
          {{ t('error.contactSupport') }}
        </p>
      </div>
    </div>
  </div>
</template>
