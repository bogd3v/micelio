<script setup lang="ts">
import type { Component } from 'vue'
import type { PageSection } from '~/interfaces'
import { heroLeadsPage, knownSections as filterKnown } from '~/helpers/pages'
import { sectionAnchors } from '~/helpers/landing'
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
  /** A whole page: names it with this title as the h1 unless a hero opens it (then `leadHeading` is derived) */
  pageTitle?: string
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

const { isLanding, blogEnabled } = useStaticSite()
// Only a landing needs the modules here; reading them elsewhere would shift the ids useId() gives the sections
const newsletterOn = __STATIC_BUILD__ && isLanding ? useModule('newsletter') : undefined

const titleLeads = computed<boolean>(() => props.pageTitle !== undefined && !heroLeadsPage(props.sections))
const heroLeads = computed<boolean>(() => props.pageTitle !== undefined ? heroLeadsPage(props.sections) : Boolean(props.leadHeading))
const knownSections = computed<PageSection[]>(() => filterKnown(props.sections))
// A landing's navigation links to its home page's sections by these ids (docs/operate/static-site.md, "Landing")
const anchorIds = computed<Map<number, string>>(() => __STATIC_BUILD__ && isLanding
  ? new Map(sectionAnchors(knownSections.value, { newsletterOn: newsletterOn?.value ?? false, blogEnabled }).map(anchor => [anchor.index, anchor.id]))
  : new Map())
</script>

<template>
  <section v-if="titleLeads" class="myc-section" data-section="title">
    <div class="myc-section-inner">
      <h1 class="myc-section-title">{{ pageTitle }}</h1>
    </div>
  </section>
  <component
    :is="componentMap[section.__component]"
    v-for="(section, index) in knownSections"
    :id="anchorIds.get(index)"
    :key="`${section.__component}-${index}`"
    :section="section"
    v-bind="index === 0 && section.__component === 'section.hero' && heroLeads ? { headingLevel: 1 } : index === 0 && section.__component === 'section.scene' ? { eager: true } : {}"
  />
</template>

<style>
@layer myc.reset, myc.settings, myc.base, myc.components, myc.layout, myc.pages, myc.theme, myc.animations, myc.utilities;
@import "~/assets/css/components/section.css" layer(myc.components);
@import "~/assets/css/components/section-hero.css" layer(myc.components);
@import "~/assets/css/components/section-logos.css" layer(myc.components);
@import "~/assets/css/components/section-pricing.css" layer(myc.components);
@import "~/assets/css/components/section-faq.css" layer(myc.components);
@import "~/assets/css/animations/section-marquee.css" layer(myc.animations);
@import "#build/micelio/sections.css" layer(myc.theme);
</style>
