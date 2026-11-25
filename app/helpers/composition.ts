import type { PageSection, SectionGroup } from '~/interfaces'

// The composition of a page (ADR 0022): what each position draws and the bands of its groups. Only `SectionRenderer` imports it, so its code stays out of the bundle of the pages that draw no section

/** The section a page draws at a position: a reference with its `block` draws that block (ADR 0022, section 1); any other section, an unresolved reference included, is itself. */
export function drawnSection(section: PageSection): PageSection {
  return section.__component === 'section.reusable' && section.block ? section.block : section
}

/** A run of the sections a page draws: the members of one group, or a single section that is in none. */
export interface SectionRun {
  /** The group the members share; absent for a section outside any group. */
  group?: SectionGroup
  /** The members, each with its position among the known sections. */
  members: Array<{ index: number, section: PageSection }>
}

/**
 * The known sections cut into runs: consecutive sections that share a `groupId` form one run, which the renderer wraps in `myc-group` (ADR 0022, section 2).
 *
 * @remarks
 * The run takes the `tone` of its first member. Stored content is not re-checked by the CMS, so a `groupId` that comes back after another section makes a second run, and a member whose `tone` differs follows the first.
 */
export function sectionRuns(sections: readonly PageSection[]): SectionRun[] {
  const runs: SectionRun[] = []
  sections.forEach((section, index) => {
    const group = 'group' in section ? section.group : undefined
    const last = runs.at(-1)
    if (group && last?.group?.groupId === group.groupId) last.members.push({ index, section })
    else runs.push({ ...(group && { group }), members: [{ index, section }] })
  })
  return runs
}
