<script setup lang="ts">
import { Locale } from '~/interfaces'
import type { LocaleSwitchTarget } from '~/interfaces'
import { isReadingPath } from '~/helpers/header'
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

// Static: SSR renders the header and footer before an article sets its translated slug, so
// the other language of a reading page goes to its blog until the build knows the translation
function staticTarget(next: Locale): LocaleSwitchTarget | string {
  if (next === locale.value || !isReadingPath(route.path)) return switchLocale(next)
  return localizedPath('/blog', next)
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
        :to="staticTarget(option)"
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
