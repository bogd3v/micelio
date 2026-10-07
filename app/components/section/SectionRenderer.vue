<script setup lang="ts">
import type { Component } from 'vue'
import type { PageSection } from '~/interfaces'
import { knownSections as filterKnown } from '~/helpers/pages'
import SectionHero from '~/components/section/SectionHero.vue'
import SectionFeatureGrid from '~/components/section/SectionFeatureGrid.vue'
import SectionMediaShowcase from '~/components/section/SectionMediaShowcase.vue'
import SectionStats from '~/components/section/SectionStats.vue'
import SectionLogoCloud from '~/components/section/SectionLogoCloud.vue'
import SectionTestimonials from '~/components/section/SectionTestimonials.vue'
import SectionPricing from '~/components/section/SectionPricing.vue'
import SectionFaq from '~/components/section/SectionFaq.vue'
import SectionCta from '~/components/section/SectionCta.vue'
import SectionPostList from '~/components/section/SectionPostList.vue'
import SectionNewsletter from '~/components/section/SectionNewsletter.vue'
import SectionRichText from '~/components/section/SectionRichText.vue'
import SectionGallery from '~/components/section/SectionGallery.vue'
import SectionScene from '~/components/section/SectionScene.vue'

const props = defineProps<{
  sections: PageSection[] | null | undefined
  /** The first section, when it is a hero, carries the page's h1 */
  leadHeading?: boolean
}>()

const componentMap: Readonly<Record<PageSection['__component'], Component>> = {
  'section.hero': SectionHero,
  'section.feature-grid': SectionFeatureGrid,
  'section.media-showcase': SectionMediaShowcase,
  'section.stats': SectionStats,
  'section.logo-cloud': SectionLogoCloud,
  'section.testimonials': SectionTestimonials,
  'section.pricing': SectionPricing,
  'section.faq': SectionFaq,
  'section.cta': SectionCta,
  'section.post-list': SectionPostList,
  'section.newsletter': SectionNewsletter,
  'section.rich-text': SectionRichText,
  'section.gallery': SectionGallery,
  'section.scene': SectionScene,
}

const knownSections = computed<PageSection[]>(() => filterKnown(props.sections))
</script>

<template>
  <component
    :is="componentMap[section.__component]"
    v-for="(section, index) in knownSections"
    :key="`${section.__component}-${index}`"
    :section="section"
    v-bind="index === 0 && section.__component === 'section.hero' && leadHeading ? { headingLevel: 1 } : {}"
  />
</template>

<style>
@layer bd.reset, bd.settings, bd.base, bd.components, bd.layout, bd.pages, bd.theme, bd.animations, bd.utilities;
@import "~/assets/css/components/section.css" layer(bd.components);
@import "~/assets/css/components/section-hero.css" layer(bd.components);
@import "~/assets/css/components/section-logos.css" layer(bd.components);
@import "~/assets/css/components/section-pricing.css" layer(bd.components);
@import "~/assets/css/components/section-faq.css" layer(bd.components);
@import "~/assets/css/animations/section-marquee.css" layer(bd.animations);
@import "#build/micelio/sections.css" layer(bd.theme);
</style>
