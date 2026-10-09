<script setup lang="ts">
const { t } = useI18n()
const { localizePath } = useLocaleUtils()
useAccountPage(() => t('account.meta.confirmed'))
</script>

<template>
  <AccountShell>
    <div class="myc-account-view">
      <div class="myc-account-icon">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><circle cx="28" cy="28" r="22" /><path d="M18 28 L25 35 L39 21" stroke-linecap="square" /></svg>
      </div>
      <AccountHeading :eyebrow="t('account.eyebrow.confirmed')" :title="t('account.confirmed.title')">
        {{ t('account.confirmed.lead') }}
      </AccountHeading>
      <div>
        <MycButton :href="localizePath('/account/sign-in')" arrow>{{ t('account.confirmed.signIn') }}</MycButton>
      </div>
    </div>
  </AccountShell>
</template>
