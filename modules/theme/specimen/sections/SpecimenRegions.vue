<script setup lang="ts">
import { layout } from '#micelio/theme'
import { variants as alternates } from '#micelio/specimen-variants'
import type { Category, FieldGuideTopic } from '~/interfaces'
import { CATEGORIES } from '~/helpers/categories'
import { ARTICLE, FEATURED_POST, POSTS } from '../fixtures'

const { t } = useI18n()

// Headers and footers the theme does not use; the specimen registers them under their own names
const chrome = alternates
  .filter(({ region }) => region === 'header' || region === 'footer')
  .map(({ region, variant, component }) => ({
    region,
    variant,
    component,
    view: resolveComponent(component),
    // A distinct label keeps the copy's navigation apart from the page's own (the columns footer labels its groups by heading)
    props: {
      ...(region === 'header' ? { active: 'blog', reading: false } : {}),
      ...(region === 'header' || variant === 'minimal' ? { label: t('specimen.regions.navLabel', { variant: t(`specimen.regions.variantNames.${variant}`) }) } : {}),
    },
  }))
// Post list, home and article variants the theme does not use
const content = alternates
  .filter(({ region }) => region === 'postList' || region === 'home' || region === 'article')
  .map(({ region, variant, component }) => ({ region, variant, component, view: resolveComponent(component) }))
// The copies repeat the ids of the active region; each gets its own (client side, specimen only; limits in docs/theme-testing.md)
const copies = ref<HTMLElement[]>([])
const ID_REFS = ['for', 'form', 'headers', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage']

function renameRefs(frame: HTMLElement, from: string, to: string): void {
  for (const name of ID_REFS) {
    for (const element of frame.querySelectorAll(`[${name}~="${CSS.escape(from)}"]`)) {
      element.setAttribute(name, element.getAttribute(name)!.split(/\s+/).map(token => token === from ? to : token).join(' '))
    }
  }
  for (const element of frame.querySelectorAll(`a[href="#${CSS.escape(from)}"]`)) element.setAttribute('href', `#${to}`)
}

function renameIds(frame: HTMLElement, index: number): void {
  const ids = new Map<string, string>()
  for (const element of frame.querySelectorAll('[id]')) {
    const next = `${element.id}-copy${index}`
    ids.set(element.id, next)
    element.id = next
  }
  for (const [from, to] of ids) renameRefs(frame, from, to)
}

onMounted(() => copies.value.forEach((frame, index) => renameIds(frame, index)))
const regions: Array<[string, string]> = Object.entries(layout)
const counts = Object.fromEntries(CATEGORIES.map((category, index) => [category, index + 1])) as Partial<Record<Category, number>>
const topics: FieldGuideTopic[] = CATEGORIES.map((category, index) => ({ category, count: index + 1 }))
</script>

<template>
  <div class="bd-specimen-stack">
    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.regions.active') }}</h3>
      <dl class="bd-specimen-variants">
        <template v-for="[region, variant] in regions" :key="region">
          <dt>{{ region }}</dt>
          <dd><code>{{ variant }}</code></dd>
        </template>
      </dl>
      <p class="bd-body-s">{{ t('specimen.regions.chrome') }}</p>
    </div>

    <div v-for="{ region, variant, component, view, props } in chrome" :key="component">
      <h3 class="bd-specimen-label">{{ t(`specimen.regions.${region}Variant`, { variant: t(`specimen.regions.variantNames.${variant}`) }) }}</h3>
      <div ref="copies" class="bd-specimen-frame">
        <component :is="view" v-bind="props" />
      </div>
    </div>

    <div v-for="{ region, variant, component, view } in content" :key="component">
      <h3 class="bd-specimen-label">{{ t(`specimen.regions.${region}Variant`, { variant: t(`specimen.regions.variantNames.${variant}`) }) }}</h3>
      <div ref="copies" class="bd-specimen-frame">
        <component :is="view" v-if="region === 'postList'" :posts="POSTS" view="grid" :federated="false" />
        <component :is="view" v-else-if="region === 'home'" :featured-post="FEATURED_POST" :total="POSTS.length" :counts="counts" :topics="topics" />
        <component :is="view" v-else :post="ARTICLE" share-url="https://example.com/blog/specimen" draft />
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.regions.postList') }}</h3>
      <div class="bd-specimen-frame">
        <RegionPostList :posts="POSTS" view="grid" :federated="false" />
      </div>
      <div class="bd-specimen-frame">
        <RegionPostList :posts="POSTS" view="log" :federated="false" />
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.regions.home') }}</h3>
      <div class="bd-specimen-frame">
        <RegionHome :featured-post="FEATURED_POST" :total="POSTS.length" :counts="counts" :topics="topics" />
      </div>
    </div>

    <div>
      <h3 class="bd-specimen-label">{{ t('specimen.regions.article') }}</h3>
      <div class="bd-specimen-frame">
        <RegionArticle :post="ARTICLE" share-url="https://example.com/blog/specimen" draft />
      </div>
    </div>
  </div>
</template>
