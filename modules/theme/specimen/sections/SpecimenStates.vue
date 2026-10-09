<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="myc-specimen-stack">
    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.states.notices') }}</h3>
      <div class="myc-specimen-stack">
        <AccountNotice tone="info">{{ t('specimen.states.info') }}</AccountNotice>
        <AccountNotice tone="error">{{ t('specimen.states.error') }}</AccountNotice>
      </div>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.states.loading') }}</h3>
      <div class="myc-specimen-row">
        <MycButton disabled aria-busy="true">
          <IconsArrowPath />
          {{ t('specimen.states.loadingLabel') }}
        </MycButton>
      </div>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.states.empty') }}</h3>
      <ThemeEmptyState class="myc-latest-empty">
        <h3 class="myc-latest-empty-title">{{ t('specimen.states.emptyTitle') }}</h3>
        <p class="myc-meta myc-home-eyebrow myc-latest-empty-note">{{ t('specimen.states.emptyNote') }}</p>
        <button type="button" class="myc-chip">{{ t('specimen.states.showAll') }} <span aria-hidden="true">→</span></button>
      </ThemeEmptyState>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.states.errorPage') }}</h3>
      <div class="myc-specimen-frame">
        <div class="myc-error-body">
          <div class="myc-error-code">
            <span class="myc-error-code-text font-display">404</span>
          </div>
          <h4 class="myc-error-title font-display">{{ t('error.pageNotFound') }}</h4>
          <p class="myc-error-text">{{ t('error.notExist') }}</p>
          <div class="myc-error-actions">
            <MycButton href="/">
              <IconsHome />
              {{ t('error.goHome') }}
            </MycButton>
            <MycButton href="/blog" variant="secondary">
              <IconsDocumentText />
              {{ t('error.browseBlog') }}
            </MycButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
