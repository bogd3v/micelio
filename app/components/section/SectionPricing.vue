<script setup lang="ts">
import type { PricingSection } from '~/interfaces'

const props = defineProps<{ section: PricingSection }>()

const { t } = useI18n()
const titleId = useId()

const hasActions = computed<boolean>(() => props.section.plans.some(plan => plan.link))
</script>

<template>
  <section class="bd-section" data-section="pricing" :data-variant="section.variant" :aria-labelledby="section.title ? titleId : undefined">
    <div class="bd-section-inner">
      <SectionHead :title="section.title" :text="section.text" :title-id="titleId" />

      <table v-if="section.variant === 'table'" class="bd-section-items">
        <caption class="bd-sr">{{ section.title || t('sections.pricing.caption') }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('sections.pricing.plan') }}</th>
            <th scope="col">{{ t('sections.pricing.price') }}</th>
            <th scope="col">{{ t('sections.pricing.includes') }}</th>
            <th v-if="hasActions" scope="col"><span class="bd-sr">{{ t('sections.pricing.action') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(plan, index) in section.plans" :key="index" :class="['bd-section-item', 'bd-section-plan', { 'bd-section-plan-recommended': plan.recommended }]">
            <th scope="row" class="bd-section-item-title">
              {{ plan.name }}
              <span v-if="plan.recommended" class="bd-meta"> · {{ t('sections.recommended') }}</span>
            </th>
            <td class="bd-section-plan-price">
              <strong>{{ plan.price }}</strong>
              <span v-if="plan.period"> {{ plan.period }}</span>
            </td>
            <td>
              <ul class="bd-section-plan-features">
                <li v-for="(feature, at) in plan.features" :key="at">{{ feature }}</li>
              </ul>
            </td>
            <td v-if="hasActions">
              <SectionLink :link="plan.link" variant="secondary" />
            </td>
          </tr>
        </tbody>
      </table>

      <ul v-else class="bd-section-items">
        <li v-for="(plan, index) in section.plans" :key="index" :class="['bd-section-item', 'bd-section-plan', { 'bd-section-plan-recommended': plan.recommended }]">
          <p v-if="plan.recommended" class="bd-eyebrow">{{ t('sections.recommended') }}</p>
          <h3 class="bd-section-item-title">{{ plan.name }}</h3>
          <p class="bd-section-plan-price">
            <strong>{{ plan.price }}</strong>
            <span v-if="plan.period"> {{ plan.period }}</span>
          </p>
          <ul class="bd-section-plan-features">
            <li v-for="(feature, at) in plan.features" :key="at">{{ feature }}</li>
          </ul>
          <SectionLink :link="plan.link" :variant="plan.recommended ? 'primary' : 'secondary'" />
        </li>
      </ul>
    </div>
  </section>
</template>
