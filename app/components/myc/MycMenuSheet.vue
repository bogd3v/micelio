<script setup lang="ts">
import { blogPath } from '~/helpers/blog'
import type { HeaderSection } from '~/interfaces'
import { modes } from '#micelio/theme'
import { CATEGORIES, categoryColor } from '~/helpers/categories'

const SWIPE_CLOSE_DISTANCE = 80

const props = withDefaults(defineProps<{
  open: boolean
  active?: HeaderSection
}>(), {
  active: undefined,
})

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const route = useRoute()
const { localizePath } = useLocaleUtils()
const fediverseUser = useFediverseUser()
const accountsOn = useModule('accounts')
const draftsOn = useModule('drafts')
const fediverseOn = useModule('fediverse')
const { user, isEditor } = useAuth()

const dialogRef = ref<HTMLElement>()
const isOpen = computed<boolean>(() => props.open)
const dragOffset = ref(0)
let dragStart: number | null = null

const sections = useNavLinks()
const topics = computed<{ slug: string, label: string, color: string, to: string }[]>(() =>
  CATEGORIES.map(slug => ({
    slug,
    label: t(`myc.categoryShort.${slug}`),
    color: categoryColor(slug),
    to: blogPath({ category: slug, page: 1 }, localizePath('/blog')),
  })),
)
const panelStyle = computed<Record<string, string> | undefined>(() =>
  dragOffset.value > 0 ? { transform: `translateY(${dragOffset.value}px)` } : undefined,
)

function close(): void {
  emit('close')
}

function onCancel(event: Event): void {
  event.preventDefault()
  close()
}

function onDialogClick(event: MouseEvent): void {
  if (event.target === dialogRef.value) close()
}

function onDragStart(event: PointerEvent): void {
  if ((event.target as Element).closest('button')) return
  dragStart = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onDragMove(event: PointerEvent): void {
  if (dragStart === null) return
  dragOffset.value = Math.max(0, event.clientY - dragStart)
}

function onDragEnd(): void {
  if (dragStart === null) return
  const shouldClose = dragOffset.value > SWIPE_CLOSE_DISTANCE
  dragStart = null
  // A swipe that closes keeps its offset, so the exit starts where the finger left the panel
  if (shouldClose) close()
  else dragOffset.value = 0
}

watch(isOpen, (open) => {
  const dialog = dialogRef.value as HTMLDialogElement | undefined
  if (!dialog) return
  if (open && !dialog.open) {
    dragOffset.value = 0
    dialog.showModal()
  }
  if (!open && dialog.open) dialog.close()
})

watch(() => route.fullPath, () => {
  if (props.open) close()
})
</script>

<template>
  <dialog
    ref="dialogRef"
    class="myc-sheet"
    :aria-label="t('myc.mobile.menu')"
    @cancel="onCancel"
    @close="open && close()"
    @click="onDialogClick"
  >
    <div class="myc-sheet-panel" :style="panelStyle" :data-dragging="dragOffset > 0 ? '' : undefined">
      <div
        class="myc-sheet-grip"
        @pointerdown="onDragStart"
        @pointermove="onDragMove"
        @pointerup="onDragEnd"
        @pointercancel="onDragEnd"
      >
        <span class="myc-sheet-handle" aria-hidden="true" />
        <div class="myc-sheet-head">
          <span class="myc-eyebrow myc-sheet-label">{{ t('myc.mobile.menu') }}</span>
          <button type="button" class="myc-iconbtn myc-sheet-close" :aria-label="t('myc.mobile.close')" @click="close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
          </button>
        </div>
      </div>

      <nav class="myc-sheet-nav" :aria-label="t('myc.mobile.sections')">
        <NuxtLink
          v-for="section in sections"
          :key="section.id"
          :to="section.to"
          class="myc-sheet-link myc-wide"
          :aria-current="active === section.id ? 'page' : undefined"
        >
          {{ section.label }} <span aria-hidden="true" class="myc-sheet-arrow">→</span>
        </NuxtLink>
      </nav>

      <NuxtLink
        v-if="accountsOn"
        :to="localizePath(user ? '/account' : '/account/sign-in')"
        class="myc-sheet-link myc-sheet-account myc-wide"
      >
        {{ user ? t('myc.header.account') : t('myc.header.signIn') }} <span aria-hidden="true" class="myc-sheet-arrow">→</span>
      </NuxtLink>
      <NuxtLink
        v-if="draftsOn && isEditor"
        :to="localizePath('/drafts')"
        class="myc-sheet-link myc-sheet-drafts myc-wide"
      >
        {{ t('myc.header.drafts') }} <span aria-hidden="true" class="myc-sheet-arrow">→</span>
      </NuxtLink>

      <section class="myc-sheet-group" aria-labelledby="myc-sheet-topics">
        <h2 id="myc-sheet-topics" class="myc-eyebrow myc-sheet-label">{{ t('myc.mobile.topics') }}</h2>
        <div class="myc-sheet-topics">
          <NuxtLink v-for="topic in topics" :key="topic.slug" :to="topic.to" class="myc-sheet-cat">
            <span class="myc-sheet-dot" :style="{ background: topic.color }" aria-hidden="true" />{{ topic.label }}
          </NuxtLink>
          <NuxtLink v-if="fediverseOn" :to="`${localizePath('/')}#fediverso`" class="myc-sheet-cat" :aria-label="t('myc.header.fediverse', { handle: fediverseUser })" @click="close">
            <span class="myc-sheet-mark" aria-hidden="true">◆</span>{{ fediverseUser }}
          </NuxtLink>
        </div>
      </section>

      <div class="myc-sheet-settings">
        <div v-if="modes.length > 1" class="myc-sheet-row">
          <span>{{ t('myc.mobile.theme') }}</span>
          <MycThemeSwitch />
        </div>
        <div class="myc-sheet-row">
          <span>{{ t('myc.mobile.language') }}</span>
          <MycLangSwitch />
        </div>
      </div>
    </div>
  </dialog>
</template>
