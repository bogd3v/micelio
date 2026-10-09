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
  <div class="myc-confirm-page">
    <div class="myc-confirm-body">
      <div v-if="status === 'loading'" class="myc-confirm-card">
        <IconsArrowPath class="myc-confirm-icon myc-confirm-loading" />
        <p class="myc-confirm-status">{{ t("common.loading") }}</p>
      </div>

      <div
        v-else-if="status === 'success'"
        class="myc-confirm-card"
        data-status="success"
      >
        <IconsCheckCircle class="myc-confirm-icon" />
        <h1 class="myc-confirm-title font-display">
          {{ t("confirm.successTitle") }}
        </h1>
        <p class="myc-confirm-text">{{ successMessage }}</p>
        <MycButton href="/blog">
          {{ t("confirm.browseBlog") }}
        </MycButton>
      </div>

      <div
        v-else
        class="myc-confirm-card"
        data-status="error"
      >
        <IconsXCircle class="myc-confirm-icon" />
        <h1 class="myc-confirm-title font-display">
          {{ t("confirm.errorTitle") }}
        </h1>
        <p class="myc-confirm-text">{{ errorMessage }}</p>
        <MycButton href="/" variant="secondary">
          {{ t("confirm.goHome") }}
        </MycButton>
      </div>
    </div>
  </div>
</template>
