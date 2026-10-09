<script setup lang="ts">
import { userInitial } from '~/helpers/auth'

withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false,
})

const { t } = useI18n()
const route = useRoute()
const { localizePath } = useLocaleUtils()
const { user, isEditor, logout } = useAuth()
const { count: draftCount } = useDraftCount()
const draftsOn = useModule('drafts')

const panelRef = ref<HTMLElement>()
const open = ref(false)
const panelId = useId()

const signInTarget = computed<{ path: string, query?: { redirect: string } }>(() => {
  const path = localizePath('/account/sign-in')
  return /\/account(\/|$)/.test(route.path) ? { path } : { path, query: { redirect: route.fullPath } }
})

const draftsLabel = computed<string>(() =>
  draftCount.value === null ? t('myc.header.drafts') : t('myc.header.draftsCount', draftCount.value),
)
const showDraftCount = computed<boolean>(() => isEditor.value && draftCount.value !== null)
// One anchor per instance: the header renders the compact and the full menu
const anchor = computed<string>(() => `--myc-account-${panelId.replace(/[^a-z0-9]/gi, '')}`)

// Closing for a navigation must not send focus back to the toggle: it starts at the new page
function close(): void {
  if (!open.value) return
  const panel = panelRef.value
  if (panel?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur()
  panel?.hidePopover()
}

function onToggle(event: Event): void {
  open.value = (event as ToggleEvent).newState === 'open'
}

async function signOut(): Promise<void> {
  close()
  await logout()
  await navigateTo({ path: localizePath('/account/sign-in'), query: { notice: 'signed-out' } })
}

watch(() => route.fullPath, close)
</script>

<template>
  <div
    :class="['myc-account', { 'myc-account-compact': compact, 'myc-account-editor': isEditor }]"
  >
    <template v-if="user">
      <button
        type="button"
        class="myc-chip myc-account-toggle"
        :aria-label="t('myc.header.accountMenu', { username: user.username })"
        :aria-controls="panelId"
        :popovertarget="panelId"
        :style="{ 'anchor-name': anchor }"
      >
        <span class="myc-account-avatar" aria-hidden="true">{{ userInitial(user.username) }}</span>
        <span v-if="compact && showDraftCount && draftCount" class="myc-count myc-account-badge" aria-hidden="true">{{ draftCount }}</span>
        <span class="myc-account-name" aria-hidden="true">{{ user.username }}</span>
      </button>
      <ul
        :id="panelId"
        ref="panelRef"
        popover="auto"
        class="myc-account-panel"
        :style="{ 'position-anchor': anchor }"
        @toggle="onToggle"
      >
        <li class="myc-account-who" aria-hidden="true">{{ user.email }}</li>
        <li>
          <NuxtLink :to="localizePath('/account')" class="myc-account-item">{{ t('myc.header.account') }}</NuxtLink>
        </li>
        <li v-if="draftsOn && isEditor">
          <NuxtLink :to="localizePath('/drafts')" class="myc-account-item myc-account-item-drafts" :aria-label="draftsLabel">
            {{ t('myc.header.drafts') }}
            <span v-if="showDraftCount" class="myc-count" aria-hidden="true">{{ draftCount }}</span>
          </NuxtLink>
        </li>
        <li>
          <button type="button" class="myc-account-item myc-account-item-signout" @click="signOut">{{ t('myc.header.signOut') }}</button>
        </li>
      </ul>
    </template>
    <NuxtLink
      v-else-if="compact"
      :to="signInTarget"
      class="myc-iconbtn"
      :aria-label="t('myc.header.signInLabel')"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" /></svg>
    </NuxtLink>
    <NuxtLink v-else :to="signInTarget" class="myc-chip myc-account-signin">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" /></svg>
      {{ t('myc.header.signIn') }}
    </NuxtLink>
  </div>
</template>
