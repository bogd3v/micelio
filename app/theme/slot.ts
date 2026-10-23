import { defineAsyncComponent, defineComponent, h } from 'vue'
import type { Component } from 'vue'
import type { RegionVariant } from './layout/region'
import { useThemeData } from '~/composables/useThemeData'

/** The components of one slot, from `#micelio/slots/<Name>.mjs` (`slotModule` in `modules/theme/slots.ts`). */
export interface SlotEntries {
  /** The core default in `app/theme/defaults/`, for a theme without its own component. */
  fallback: RegionVariant
  /** The themes of the build that ship their own component, by id. */
  themes: Record<string, RegionVariant>
}

/**
 * The component of a slot: it renders the active theme's own component, or the core default, at runtime (ADR 0005,
 * section 4; ADR 0009, #402).
 *
 * @remarks
 * The theme comes from `useThemeData().id`. The build's theme's component is bundled; any other is its own chunk, loaded
 * with `defineAsyncComponent`, rendered by the server and hydrated by the client. Attributes, listeners and Vue slots pass
 * through. `T` is the core default's type, which every theme's component of the slot matches (the slot API), so call
 * sites keep their prop types.
 */
export function defineSlot<T>(name: string, entries: SlotEntries): T {
  const view = (entry: RegionVariant): Component => 'component' in entry ? entry.component : defineAsyncComponent(entry.load)
  const fallback = view(entries.fallback)
  const themes = Object.fromEntries(Object.entries(entries.themes).map(([id, entry]) => [id, view(entry)]))
  const component = defineComponent({
    name,
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      const chosen = themes[useThemeData().id] ?? fallback
      return () => h(chosen, { ...attrs }, slots)
    },
  })
  return component as unknown as T
}
