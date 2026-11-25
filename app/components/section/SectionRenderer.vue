<script setup lang="ts">
import type { Component, FunctionalComponent } from 'vue'
import type { PageSection, SectionGroup } from '~/interfaces'
import { heroLeadsPage, knownSections as filterKnown } from '~/helpers/pages'
import { drawnSection, sectionRuns } from '~/helpers/composition'
import { sectionAnchors } from '~/helpers/landing'
import { faqStructuredData, jsonLd } from '~/helpers/faqStructuredData'
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

// What a run draws: each member's key and position, and its section, absent for a reference without its block
interface DrawnRun {
  key: string
  group?: SectionGroup
  members: Array<{ index: number, key: string, section?: PageSection }>
}

// The wrapper of a run outside any group: its member alone, with no element of its own
const Alone: FunctionalComponent = (_props, { slots }) => slots.default?.()

const props = defineProps<{
  sections: PageSection[] | null | undefined
  /** The first section, when it is a hero, carries the page's h1 */
  leadHeading?: boolean
  /** A whole page: names it with this title as the h1 unless a hero opens it (then `leadHeading` is derived) */
  pageTitle?: string
  /**
   * The attributes of each rendered section's root, by position, for the admin's preview (ADR 0019, section 5); only the draft route gives them.
   * They come ready-made so this component, which every public page loads, imports nothing for them.
   */
  markers?: Array<Record<string, string>>
  /** The positions of the blocks to show as their static alternative, which the draft route sets when the admin asks (ADR 0019, amendment of 2026-11-04); a scene is the only section with an island */
  staticBlocks?: ReadonlySet<number>
}>()

// `section.reusable` is not here: a reference draws its target's component, or nothing (ADR 0022, section 1)
const componentMap: Readonly<Record<Exclude<PageSection['__component'], 'section.reusable'>, Component>> = {
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
  'shared.rich-text': SectionRichText,
  'section.gallery': SectionGallery,
  'section.scene': SectionScene,
}

const { isLanding, blogEnabled } = useStaticSite()
// Only a landing needs the modules here; reading them elsewhere would shift the ids useId() gives the sections
const newsletterOn = __STATIC_BUILD__ && isLanding ? useModule('newsletter') : undefined

const titleLeads = computed<boolean>(() => props.pageTitle !== undefined && !heroLeadsPage(props.sections))
const heroLeads = computed<boolean>(() => props.pageTitle !== undefined ? heroLeadsPage(props.sections) : Boolean(props.leadHeading))
// The theme's own section styles are a file of its store entry, linked only on pages that have sections (ADR 0009, section 6)
const theme = useThemeData()
if (theme.sections) useHead({ link: [{ rel: 'stylesheet', href: `/_t/${theme.digest}/sections.css` }] })
const knownSections = computed<PageSection[]>(() => filterKnown(props.sections))
// What each position draws: a reference with its block is that block
const drawnSections = computed<PageSection[]>(() => knownSections.value.map(drawnSection))
// The bands of the page: consecutive members of a group share one `myc-group` (ADR 0022, section 2); a run outside any group has one member
const runs = computed<DrawnRun[]>(() => {
  const seen = new Map<string, number>()
  return sectionRuns(knownSections.value).map(({ group, members }) => {
    const drawn = members.map(({ index }) => ({ index, key: keyOf(knownSections.value[index]!, index), section: drawnAt(index, Boolean(group)) }))
    if (!group) return { key: drawn[0]!.key, members: drawn }
    const count = (seen.get(group.groupId) ?? 0) + 1
    seen.set(group.groupId, count)
    return { key: `group:${group.groupId}:${count}`, group, members: drawn }
  })
})
// One JSON-LD `FAQPage` with the questions of every faq block of the page; here and not in `usePageSeo`, so its code stays out of the entry bundle every page loads
useHead({
  script: () => {
    const faq = faqStructuredData(drawnSections.value)
    return faq ? [{ type: 'application/ld+json', innerHTML: jsonLd(faq) }] : []
  },
})
// A landing's navigation links to its home page's sections by these ids (docs/operate/static-site.md, "Landing")
const anchorIds = computed<Map<number, string>>(() => __STATIC_BUILD__ && isLanding
  ? new Map(sectionAnchors(knownSections.value, { newsletterOn: newsletterOn?.value ?? false, blogEnabled }).map(anchor => [anchor.index, anchor.id]))
  : new Map())

// The section a position draws, or undefined for a reference without its block; a member of a group yields its own `tone` to the group's
function drawnAt(index: number, inGroup: boolean): PageSection | undefined {
  const section = drawnSections.value[index]!
  if (section.__component === 'section.reusable') return undefined
  return inGroup ? Object.fromEntries(Object.entries(section).filter(([name]) => name !== 'tone')) as PageSection : section
}

function keyOf(section: PageSection, index: number): string {
  return `${section.blockId ?? `${section.__component}-${index}`}${props.staticBlocks?.has(index) ? '-static' : ''}`
}

// The props of the first section and, on the draft route, the markers of every root; a public page binds nothing more than before
function bindingsOf(section: PageSection, index: number): Record<string, unknown> {
  const own = index === 0 && section.__component === 'section.hero' && heroLeads.value ? { headingLevel: 1 } : index === 0 && section.__component === 'section.scene' ? { eager: true } : {}
  const mode = section.__component === 'section.scene' && props.staticBlocks?.has(index) ? { renderStatic: true } : {}
  return props.markers ? { ...own, ...mode, ...props.markers[index] } : { ...own, ...mode }
}
</script>

<template>
  <section v-if="titleLeads" class="myc-section" data-section="title">
    <div class="myc-section-inner">
      <h1 class="myc-section-title">{{ pageTitle }}</h1>
    </div>
  </section>
  <component :is="run.group ? 'div' : Alone" v-for="run in runs" :key="run.key" v-bind="run.group && { 'class': 'myc-group', 'data-tone': run.group.tone }">
    <template v-for="member in run.members" :key="member.key">
      <component :is="componentMap[member.section.__component as keyof typeof componentMap]" v-if="member.section" :id="anchorIds.get(member.index)" :section="member.section" v-bind="bindingsOf(member.section, member.index)" />
      <div v-else-if="markers" v-bind="markers[member.index]" />
    </template>
  </component>
</template>

<style>
@layer myc.reset, myc.settings, myc.base, myc.components, myc.layout, myc.pages, myc.theme, myc.animations, myc.utilities;
@import "~/assets/css/components/section.css" layer(myc.components);
@import "~/assets/css/components/section-hero.css" layer(myc.components);
@import "~/assets/css/components/section-logos.css" layer(myc.components);
@import "~/assets/css/components/section-pricing.css" layer(myc.components);
@import "~/assets/css/components/section-faq.css" layer(myc.components);
@import "~/assets/css/components/group.css" layer(myc.components);
@import "~/assets/css/components/section-options.css" layer(myc.components);
@import "~/assets/css/animations/section-marquee.css" layer(myc.animations);
</style>
