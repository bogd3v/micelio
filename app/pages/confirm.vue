<script setup lang="ts">
import { asApiError } from '~/helpers/apiError'
import { isNewsletterToken } from '~/helpers/newsletter'
import type { ConfirmResponse } from '~/interfaces/newsletter'

const { t } = useI18n()
const route = useRoute()
const site = useSite()
const token = String(route.query.token ?? '')
const valid = isNewsletterToken(token)

// Opening the link only shows the button: the subscription is confirmed by the click, so a scanner that fetches the link confirms nothing
const status = ref<'ready' | 'loading' | 'success' | 'error'>(valid ? 'ready' : 'error')
const successMessage = ref('')
const errorMessage = ref(valid ? '' : t('confirm.invalidToken'))

async function confirmSubscription() {
  if (status.value === 'loading') return
  status.value = 'loading'
  try {
    const response = await $fetch<ConfirmResponse>('/api/newsletter/confirm', {
      method: 'POST',
      body: { token },
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

useSeoMeta({
  title: t('confirm.title'),
})
</script>

<template>
  <div class="myc-confirm-page">
    <div class="myc-confirm-body">
      <form v-if="status === 'ready'" class="myc-confirm-card" data-status="ready" @submit.prevent="confirmSubscription">
        <h1 class="myc-confirm-title font-display">
          {{ t("confirm.readyTitle") }}
        </h1>
        <p class="myc-confirm-text">{{ t("confirm.readyLead", { site: site.name }) }}</p>
        <MycButton type="submit">
          {{ t("confirm.action") }}
        </MycButton>
      </form>

      <div v-else-if="status === 'loading'" class="myc-confirm-card">
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
