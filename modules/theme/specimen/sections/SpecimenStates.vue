<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="bd-specimen-stack">
    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.states.notices') }}</h3>
      <div class="bd-specimen-stack">
        <AccountNotice tone="info">{{ t('specimen.states.info') }}</AccountNotice>
        <AccountNotice tone="error">{{ t('specimen.states.error') }}</AccountNotice>
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.states.loading') }}</h3>
      <div class="bd-specimen-row">
        <BdButton disabled aria-busy="true">
          <IconsArrowPath />
          {{ t('specimen.states.loadingLabel') }}
        </BdButton>
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.states.empty') }}</h3>
      <ThemeEmptyState class="bd-latest-empty">
        <h3 class="bd-latest-empty-title">{{ t('specimen.states.emptyTitle') }}</h3>
        <p class="bd-meta bd-home-eyebrow bd-latest-empty-note">{{ t('specimen.states.emptyNote') }}</p>
        <button type="button" class="bd-chip">{{ t('specimen.states.showAll') }} <span aria-hidden="true">→</span></button>
      </ThemeEmptyState>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.states.errorPage') }}</h3>
      <div class="bd-specimen-frame">
        <div class="bd-error-body">
          <div class="bd-error-code">
            <span class="bd-error-code-text font-display">404</span>
          </div>
          <h4 class="bd-error-title font-display">{{ t('error.pageNotFound') }}</h4>
          <p class="bd-error-text">{{ t('error.notExist') }}</p>
          <div class="bd-error-actions">
            <BdButton href="/">
              <IconsHome />
              {{ t('error.goHome') }}
            </BdButton>
            <BdButton href="/blog" variant="secondary">
              <IconsDocumentText />
              {{ t('error.browseBlog') }}
            </BdButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
