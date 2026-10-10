import type { Component } from 'vue'
import SpecimenFoundations from './sections/SpecimenFoundations.vue'
import SpecimenControls from './sections/SpecimenControls.vue'
import SpecimenLabels from './sections/SpecimenLabels.vue'
import SpecimenCards from './sections/SpecimenCards.vue'
import SpecimenProse from './sections/SpecimenProse.vue'
import SpecimenForms from './sections/SpecimenForms.vue'
import SpecimenStates from './sections/SpecimenStates.vue'
import SpecimenRegions from './sections/SpecimenRegions.vue'
import SpecimenPageSection from './sections/SpecimenPageSection.vue'
import { PAGE_SECTION_COMPONENTS } from '../../../app/interfaces/page'

interface SpecimenSection {
  /** Anchor of the group (`#id`) and its `data-section`. */
  id: string
  /** i18n key of the group's heading. */
  title: string
  component: Component
  props?: Record<string, unknown>
}

// A group is one entry: later work appends its own and touches nothing else
/**
 * The groups of the `/_theme` page, in order: each has an anchor, a heading key and the component that renders it.
 *
 * @remarks
 * Each page section kind of `PAGE_SECTION_COMPONENTS` gets one group, with the id `page-<kind>`, rendered with its `kind` prop.
 */
export const SPECIMEN_SECTIONS: SpecimenSection[] = [
  { id: 'foundations', title: 'specimen.sections.foundations', component: SpecimenFoundations },
  { id: 'controls', title: 'specimen.sections.controls', component: SpecimenControls },
  { id: 'labels', title: 'specimen.sections.labels', component: SpecimenLabels },
  { id: 'cards', title: 'specimen.sections.cards', component: SpecimenCards },
  { id: 'prose', title: 'specimen.sections.prose', component: SpecimenProse },
  { id: 'forms', title: 'specimen.sections.forms', component: SpecimenForms },
  { id: 'states', title: 'specimen.sections.states', component: SpecimenStates },
  { id: 'regions', title: 'specimen.sections.regions', component: SpecimenRegions },
  // The page section catalog (#244): a group per section, ids `page-<kind>` (the sections' own `data-section` is the bare kind)
  ...PAGE_SECTION_COMPONENTS.map(kind => ({ id: `page-${kind}`, title: `specimen.pageSections.kinds.${kind}`, component: SpecimenPageSection, props: { kind } })),
]
