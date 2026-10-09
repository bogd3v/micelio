<script setup lang="ts">
import { asApiError } from '~/helpers/apiError'
import type { ConfirmResponse } from '~/interfaces/newsletter'

const { t } = useI18n()
const route = useRoute()
const site = useSite()
const token = route.query.token as string

const status = ref<'loading' | 'success' | 'error'>('loading')
const successMessage = ref('')
const errorMessage = ref('')

async function confirmSubscription() {
  if (!token) {
    status.value = 'error'
    errorMessage.value = t('confirm.invalidToken')
    return
  }

  try {
    const response = await $fetch<ConfirmResponse>('/api/newsletter/confirm', {
      method: 'GET',
      params: { token },
    })
    successMessage.value = t(response.alreadyConfirmed ? 'confirm.alreadyConfirmed' : 'confirm.successMessage', { site: site.value.name })
    status.value = 'success'
  } catch (err) {
    const e = asApiError(err)
    status.value = 'error'
    const statusCode = e.response?.status || e.statusCode
    errorMessage.value = t(statusCode === 404 ? 'confirm.invalidToken' : 'confirm.serverError')
  }
}

onMounted(() => {
  confirmSubscription()
})

useSeoMeta({
  title: t('confirm.title'),
})
</script>

<template>
  <div class="bd-confirm-page">
    <div class="bd-confirm-body">
      <div v-if="status === 'loading'" class="bd-confirm-card">
        <IconsArrowPath class="bd-confirm-icon bd-confirm-loading" />
        <p class="bd-confirm-status">{{ t("common.loading") }}</p>
      </div>

      <div
        v-else-if="status === 'success'"
        class="bd-confirm-card"
        data-status="success"
      >
        <IconsCheckCircle class="bd-confirm-icon" />
        <h1 class="bd-confirm-title font-display">
          {{ t("confirm.successTitle") }}
        </h1>
        <p class="bd-confirm-text">{{ successMessage }}</p>
        <BdButton href="/blog">
          {{ t("confirm.browseBlog") }}
        </BdButton>
      </div>

      <div
        v-else
        class="bd-confirm-card"
        data-status="error"
      >
        <IconsXCircle class="bd-confirm-icon" />
        <h1 class="bd-confirm-title font-display">
          {{ t("confirm.errorTitle") }}
        </h1>
        <p class="bd-confirm-text">{{ errorMessage }}</p>
        <BdButton href="/" variant="secondary">
          {{ t("confirm.goHome") }}
        </BdButton>
      </div>
    </div>
  </div>
</template>
