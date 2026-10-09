<script setup lang="ts">
import { formatDotDate } from '~/helpers/formatDate'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const { localizePath } = useLocaleUtils()
const { user, isEditor, logout } = useAuth()
useAccountPage(() => t('account.meta.profile'))

const signingOut = ref(false)

const roleLabel = computed<string>(() => t(`account.roles.${user.value?.role ?? 'reader'}`))

async function signOut(): Promise<void> {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await logout()
    await navigateTo({ path: localizePath('/account/sign-in'), query: { notice: 'signed-out' } })
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <AccountShell>
    <div v-if="user" class="myc-account-view">
      <AccountHeading :eyebrow="t('account.eyebrow.profile', { role: roleLabel })" :title="t('account.profile.title')" />
      <dl class="myc-account-facts">
        <dt class="myc-eyebrow">{{ t('account.profile.username') }}</dt>
        <dd><span class="myc-account-mono">{{ user.username }}</span></dd>
        <dt class="myc-eyebrow">{{ t('account.profile.email') }}</dt>
        <dd>{{ user.email }}</dd>
        <dt class="myc-eyebrow">{{ t('account.profile.role') }}</dt>
        <dd><span :class="['myc-badge', `myc-badge-${user.role}`]">{{ roleLabel }}</span></dd>
        <template v-if="user.createdAt">
          <dt class="myc-eyebrow">{{ t('account.profile.memberSince') }}</dt>
          <dd><span class="myc-account-mono">{{ formatDotDate(user.createdAt) }}</span></dd>
        </template>
      </dl>
      <NuxtLink v-if="isEditor" :to="localizePath('/drafts')" class="myc-account-drafts">
        <span class="myc-corner myc-corner-tl" aria-hidden="true" />
        <span class="myc-corner myc-corner-br" aria-hidden="true" />
        <span class="myc-account-drafts-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M6 3 H14 L19 8 V21 H6 Z M14 3 V8 H19 M9 13 H16 M9 17 H13" /></svg>
        </span>
        <span class="myc-account-drafts-body">
          <span class="myc-account-drafts-title">{{ t('account.profile.drafts') }}</span>
          <span class="myc-account-drafts-lead">{{ t('account.profile.draftsLead') }}</span>
        </span>
        <span class="myc-account-drafts-arrow" aria-hidden="true">→</span>
      </NuxtLink>
      <div class="myc-account-actions myc-account-actions-start">
        <BdButton variant="secondary" @click="signOut">{{ t('account.profile.signOut') }}</BdButton>
      </div>
      <AccountDangerZone :username="user.username" />
    </div>
  </AccountShell>
</template>
