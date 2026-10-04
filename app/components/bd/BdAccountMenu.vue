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

const rootRef = ref<HTMLElement>()
const toggleRef = ref<HTMLButtonElement>()
const open = ref(false)
const panelId = useId()

const signInTarget = computed<{ path: string, query?: { redirect: string } }>(() => {
  const path = localizePath('/account/sign-in')
  return /\/account(\/|$)/.test(route.path) ? { path } : { path, query: { redirect: route.fullPath } }
})

const draftsLabel = computed<string>(() =>
  draftCount.value === null ? t('bd.header.drafts') : t('bd.header.draftsCount', draftCount.value),
)
const showDraftCount = computed<boolean>(() => isEditor.value && draftCount.value !== null)

function close(returnFocus = false): void {
  if (!open.value) return
  open.value = false
  if (returnFocus) toggleRef.value?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close(true)
}

async function signOut(): Promise<void> {
  close()
  await logout()
  await navigateTo({ path: localizePath('/account/sign-in'), query: { notice: 'signed-out' } })
}

onClickOutside(rootRef, () => close())

watch(() => route.fullPath, () => close())
</script>

<template>
  <div
    ref="rootRef"
    :class="['bd-account', { 'bd-account-compact': compact, 'bd-account-editor': isEditor }]"
    @keydown="onKeydown"
  >
    <template v-if="user">
      <button
        ref="toggleRef"
        type="button"
        class="bd-chip bd-account-toggle"
        :aria-label="t('bd.header.accountMenu', { username: user.username })"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="panelId"
        @click="open = !open"
      >
        <span class="bd-account-avatar" aria-hidden="true">{{ userInitial(user.username) }}</span>
        <span v-if="compact && showDraftCount && draftCount" class="bd-count bd-account-badge" aria-hidden="true">{{ draftCount }}</span>
        <span class="bd-account-name" aria-hidden="true">{{ user.username }}</span>
      </button>
      <ul v-show="open" :id="panelId" class="bd-account-panel">
        <li class="bd-account-who" aria-hidden="true">{{ user.email }}</li>
        <li>
          <NuxtLink :to="localizePath('/account')" class="bd-account-item">{{ t('bd.header.account') }}</NuxtLink>
        </li>
        <li v-if="draftsOn && isEditor">
          <NuxtLink :to="localizePath('/drafts')" class="bd-account-item bd-account-item-drafts" :aria-label="draftsLabel">
            {{ t('bd.header.drafts') }}
            <span v-if="showDraftCount" class="bd-count" aria-hidden="true">{{ draftCount }}</span>
          </NuxtLink>
        </li>
        <li>
          <button type="button" class="bd-account-item bd-account-item-signout" @click="signOut">{{ t('bd.header.signOut') }}</button>
        </li>
      </ul>
    </template>
    <NuxtLink
      v-else-if="compact"
      :to="signInTarget"
      class="bd-iconbtn"
      :aria-label="t('bd.header.signInLabel')"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" /></svg>
    </NuxtLink>
    <NuxtLink v-else :to="signInTarget" class="bd-chip bd-account-signin">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" /></svg>
      {{ t('bd.header.signIn') }}
    </NuxtLink>
  </div>
</template>
