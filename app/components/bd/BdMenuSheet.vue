<script setup lang="ts">
import type { HeaderSection } from '~/interfaces'
import { CATEGORIES, CATEGORY_INFO } from '~/helpers/categories'

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
const { user, isEditor } = useAuth()

const dialogRef = ref<HTMLElement>()
const isOpen = computed<boolean>(() => props.open)
const dragOffset = ref(0)
let dragStart: number | null = null

useFocusTrap(dialogRef, isOpen)

const sections = computed<{ id: HeaderSection, label: string, to: string }[]>(() => [
  { id: 'home', label: t('nav.home'), to: localizePath('/') },
  { id: 'blog', label: t('nav.blog'), to: localizePath('/blog') },
  { id: 'about', label: t('nav.about'), to: localizePath('/about') },
])
const topics = computed<{ slug: string, label: string, color: string, to: string }[]>(() =>
  CATEGORIES.map(slug => ({
    slug,
    label: t(`bd.categoryShort.${slug}`),
    color: `var(--${CATEGORY_INFO[slug].token})`,
    to: `${localizePath('/blog')}?category=${slug}`,
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
  dragOffset.value = 0
  if (shouldClose) close()
}

watch(isOpen, (open) => {
  const dialog = dialogRef.value as HTMLDialogElement | undefined
  if (!dialog) return
  if (open && !dialog.open) dialog.showModal()
  if (!open && dialog.open) dialog.close()
})

watch(() => route.fullPath, () => {
  if (props.open) close()
})
</script>

<template>
  <dialog
    ref="dialogRef"
    class="bd-sheet"
    :aria-label="t('bd.mobile.menu')"
    @cancel="onCancel"
    @close="open && close()"
    @click="onDialogClick"
  >
    <div class="bd-sheet-panel" :style="panelStyle">
      <div
        class="bd-sheet-grip"
        @pointerdown="onDragStart"
        @pointermove="onDragMove"
        @pointerup="onDragEnd"
        @pointercancel="onDragEnd"
      >
        <span class="bd-sheet-handle" aria-hidden="true" />
        <div class="bd-sheet-head">
          <span class="bd-eyebrow bd-sheet-label">{{ t('bd.mobile.menu') }}</span>
          <button type="button" class="bd-iconbtn bd-sheet-close" :aria-label="t('bd.mobile.close')" @click="close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
          </button>
        </div>
      </div>

      <nav class="bd-sheet-nav" :aria-label="t('bd.mobile.sections')">
        <NuxtLink
          v-for="section in sections"
          :key="section.id"
          :to="section.to"
          class="bd-sheet-link bd-wide"
          :aria-current="active === section.id ? 'page' : undefined"
        >
          {{ section.label }} <span aria-hidden="true" class="bd-sheet-arrow">→</span>
        </NuxtLink>
      </nav>

      <NuxtLink
        :to="localizePath(user ? '/account' : '/account/sign-in')"
        class="bd-sheet-link bd-sheet-account bd-wide"
      >
        {{ user ? t('bd.header.account') : t('bd.header.signIn') }} <span aria-hidden="true" class="bd-sheet-arrow">→</span>
      </NuxtLink>
      <NuxtLink
        v-if="isEditor"
        :to="localizePath('/drafts')"
        class="bd-sheet-link bd-sheet-drafts bd-wide"
      >
        {{ t('bd.header.drafts') }} <span aria-hidden="true" class="bd-sheet-arrow">→</span>
      </NuxtLink>

      <section class="bd-sheet-group" aria-labelledby="bd-sheet-topics">
        <h2 id="bd-sheet-topics" class="bd-eyebrow bd-sheet-label">{{ t('bd.mobile.topics') }}</h2>
        <div class="bd-sheet-topics">
          <NuxtLink v-for="topic in topics" :key="topic.slug" :to="topic.to" class="bd-sheet-cat">
            <span class="bd-sheet-dot" :style="{ background: topic.color }" aria-hidden="true" />{{ topic.label }}
          </NuxtLink>
          <NuxtLink :to="`${localizePath('/')}#fediverso`" class="bd-sheet-cat" :aria-label="t('bd.header.fediverse', { handle: fediverseUser })" @click="close">
            <span class="bd-hud-mark" aria-hidden="true">◆</span>{{ fediverseUser }}
          </NuxtLink>
        </div>
      </section>

      <div class="bd-sheet-settings">
        <div class="bd-sheet-row">
          <span>{{ t('bd.mobile.theme') }}</span>
          <BdThemeSwitch />
        </div>
        <div class="bd-sheet-row">
          <span>{{ t('bd.mobile.language') }}</span>
          <BdLangSwitch />
        </div>
      </div>
    </div>
  </dialog>
</template>
