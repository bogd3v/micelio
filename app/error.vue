<script setup lang="ts">
import { pageTitle } from '~/helpers/site'

const { locale, t } = useI18n()
const { localizePath } = useLocaleUtils()
const site = useSite()
const { blogEnabled } = useStaticSite()

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
  <div class="myc-error-page">
    <div class="myc-error-body">
      <div class="myc-error-code">
        <span class="myc-error-code-text font-display">
          {{ error.statusCode || 404 }}
        </span>
      </div>

      <h1 class="myc-error-title font-display">
        {{ error.statusCode === 404 ? t('error.pageNotFound') : t('error.somethingWentWrong') }}
      </h1>

      <p class="myc-error-text">
        {{ error.statusCode === 404
          ? t('error.notExist')
          : t('error.unexpected')
        }}
      </p>

      <div class="myc-error-actions">
        <BdButton @click="handleError">
          <IconsHome />
          {{ t('error.goHome') }}
        </BdButton>
        <BdButton v-if="blogEnabled" :href="localizePath('/blog')" variant="secondary">
          <IconsDocumentText />
          {{ t('error.browseBlog') }}
        </BdButton>
      </div>

      <div class="myc-error-help">
        <p>
          {{ t('error.contactSupport') }}
        </p>
      </div>
    </div>
  </div>
</template>
