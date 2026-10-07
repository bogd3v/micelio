<script setup lang="ts">
import { Locale } from '~/interfaces'
import { headerSection } from '~/helpers/header'
import { localizedPath } from '~/helpers/locale'

const emit = defineEmits<{
  change: [locale: Locale]
}>()

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const { switchLocale } = useLocaleUtils()
const { isStatic } = useStaticSite()

const options: Locale[] = [Locale.SpanishColombia, Locale.English]

// Static: this href is only the fallback (the blog or the home of that language, never a guessed translation).
// server/plugins/staticLangLinks.ts replaces it with the translation the page declares in its head
function staticHref(next: Locale): string {
  if (next === locale.value) return route.path
  return localizedPath(headerSection(route.path) === 'blog' ? '/blog' : '/', next)
}

async function select(next: Locale): Promise<void> {
  if (next === locale.value) return
  await router.push(switchLocale(next))
  emit('change', next)
}
</script>

<template>
  <div class="bd-seg-group bd-lang" role="group" :aria-label="t('bd.header.language')">
    <template v-for="option in options" :key="option">
      <NuxtLink
        v-if="isStatic"
        :to="staticHref(option)"
        :data-bd-lang="option"
        class="bd-seg"
        :lang="option"
        :hreflang="option"
        :aria-label="t(`bd.header.languages.${option}`)"
        :aria-current="locale === option ? 'true' : undefined"
      >
        {{ option.toUpperCase() }}
      </NuxtLink>
      <button
        v-else
        type="button"
        class="bd-seg"
        :lang="option"
        :aria-label="t(`bd.header.languages.${option}`)"
        :aria-pressed="locale === option ? 'true' : 'false'"
        @click="select(option)"
      >
        {{ option.toUpperCase() }}
      </button>
    </template>
  </div>
</template>
