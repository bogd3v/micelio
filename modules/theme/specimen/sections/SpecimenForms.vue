<script setup lang="ts">
const { t } = useI18n()

const email = ref('')
const invalidEmail = ref('not-an-email')
const password = ref('')
const weakPassword = ref('abc')
</script>

<template>
  <div class="myc-specimen-stack">
    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.forms.fields') }}</h3>
      <form class="myc-specimen-form" novalidate @submit.prevent>
        <AccountField id="specimen-email" v-model="email" :label="t('specimen.forms.email')" type="email" autocomplete="email" :help="t('specimen.forms.help')" />
        <AccountField id="specimen-email-invalid" v-model="invalidEmail" :label="t('specimen.forms.email')" type="email" autocomplete="email" :error="t('specimen.forms.invalid')" />
        <AccountPasswordField id="specimen-password" v-model="password" :label="t('specimen.forms.password')" autocomplete="new-password" meter />
        <AccountPasswordField id="specimen-password-invalid" v-model="weakPassword" :label="t('specimen.forms.password')" autocomplete="new-password" :error="t('specimen.forms.weak')" />
        <div class="myc-form-row">
          <label for="specimen-select" class="myc-label">{{ t('specimen.forms.select') }}</label>
          <select id="specimen-select" class="myc-select">
            <option>{{ t('specimen.forms.optionOne') }}</option>
            <option>{{ t('specimen.forms.optionTwo') }}</option>
          </select>
        </div>
        <div class="myc-form-row">
          <label for="specimen-disabled" class="myc-label">{{ t('specimen.forms.disabled') }}</label>
          <input id="specimen-disabled" class="myc-field" type="text" disabled :value="t('specimen.forms.disabledValue')">
        </div>
        <BdButton type="submit">{{ t('specimen.forms.submit') }}</BdButton>
      </form>
    </div>

    <div>
      <h3 class="myc-specimen-label">{{ t('specimen.forms.newsletter') }}</h3>
      <div class="myc-specimen-grid">
        <BdNewsletterForm id="specimen-news-idle" />
        <BdNewsletterForm id="specimen-news-error" status="error" :message="t('specimen.forms.newsletterError')" />
        <BdNewsletterForm id="specimen-news-success" status="success" :message="t('specimen.forms.newsletterSuccess')" />
      </div>
    </div>
  </div>
</template>
