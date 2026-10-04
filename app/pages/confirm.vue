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
  <div class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="max-w-md w-full text-center">
      <div v-if="status === 'loading'" class="card p-8">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-12 h-12 mx-auto mb-4 text-[var(--link)] animate-spin"
        />
        <p class="text-[var(--ink-muted)]">{{ t("common.loading") }}</p>
      </div>

      <div
        v-else-if="status === 'success'"
        class="card p-8"
        style="background-color: var(--success-soft); border-color: var(--success)"
      >
        <UIcon
          name="i-heroicons-check-circle"
          class="w-16 h-16 mx-auto mb-4"
          style="color: var(--success)"
        />
        <h1 class="font-display text-2xl font-semibold mb-2">
          {{ t("confirm.successTitle") }}
        </h1>
        <p class="text-[var(--ink-muted)] mb-6">{{ successMessage }}</p>
        <BdButton href="/blog">
          {{ t("confirm.browseBlog") }}
        </BdButton>
      </div>

      <div
        v-else
        class="card p-8"
        style="background-color: var(--danger-soft); border-color: var(--danger)"
      >
        <UIcon
          name="i-heroicons-x-circle"
          class="w-16 h-16 mx-auto mb-4"
          style="color: var(--danger)"
        />
        <h1 class="font-display text-2xl font-semibold mb-2">
          {{ t("confirm.errorTitle") }}
        </h1>
        <p class="text-[var(--ink-muted)] mb-6">{{ errorMessage }}</p>
        <BdButton href="/" variant="secondary">
          {{ t("confirm.goHome") }}
        </BdButton>
      </div>
    </div>
  </div>
</template>
