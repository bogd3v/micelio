import type { Component } from 'vue'
import SpecimenFoundations from './sections/SpecimenFoundations.vue'
import SpecimenControls from './sections/SpecimenControls.vue'
import SpecimenLabels from './sections/SpecimenLabels.vue'
import SpecimenCards from './sections/SpecimenCards.vue'
import SpecimenProse from './sections/SpecimenProse.vue'
import SpecimenForms from './sections/SpecimenForms.vue'
import SpecimenStates from './sections/SpecimenStates.vue'
import SpecimenRegions from './sections/SpecimenRegions.vue'
import SpecimenPageSections from './sections/SpecimenPageSections.vue'

export interface SpecimenSection {
  /** Anchor of the group (`#id`) and its `data-section`. */
  id: string
  /** i18n key of the group's heading. */
  title: string
  component: Component
}

// A group is one entry: later work appends its own and touches nothing else
export const SPECIMEN_SECTIONS: SpecimenSection[] = [
  { id: 'foundations', title: 'specimen.sections.foundations', component: SpecimenFoundations },
  { id: 'controls', title: 'specimen.sections.controls', component: SpecimenControls },
  { id: 'labels', title: 'specimen.sections.labels', component: SpecimenLabels },
  { id: 'cards', title: 'specimen.sections.cards', component: SpecimenCards },
  { id: 'prose', title: 'specimen.sections.prose', component: SpecimenProse },
  { id: 'forms', title: 'specimen.sections.forms', component: SpecimenForms },
  { id: 'states', title: 'specimen.sections.states', component: SpecimenStates },
  { id: 'regions', title: 'specimen.sections.regions', component: SpecimenRegions },
  // #244 appends the section catalog x variants here
  { id: 'page-sections', title: 'specimen.sections.pageSections', component: SpecimenPageSections },
]
