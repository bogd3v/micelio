<script setup lang="ts">
interface Point {
  x: number
  y: number
}

interface AppNode extends Point {
  name: string
  color: string
}

interface AddressLayout {
  fontSize: number
  width: number
  start: number
  split: number
  end: number
}

const CENTER = 160
const ADDRESS_MAX_WIDTH = 300
const ADDRESS_FONT_SIZE = 19
const MONO_ADVANCE = 0.6
const BRACKET_INSET = 3
const SERVER_ROWS: number[] = [44, 62, 80]
const APPS: AppNode[] = [
  { name: 'MASTODON', color: 'var(--category-4)', x: 70, y: 18 },
  { name: 'PIXELFED', color: 'var(--category-3)', x: 113.7, y: 49.8 },
  { name: 'PEERTUBE', color: 'var(--category-5)', x: 97, y: 101.2 },
  { name: 'MISSKEY', color: 'var(--category-1)', x: 43, y: 101.2 },
  { name: 'GOTOSOCIAL', color: 'var(--category-2)', x: 26.3, y: 49.8 },
]

const props = defineProps<{
  user: string
  domain: string
}>()

const { t } = useI18n()

const address = computed<AddressLayout>(() => {
  const length = props.user.length + props.domain.length
  const fontSize = Math.min(ADDRESS_FONT_SIZE, ADDRESS_MAX_WIDTH / (length * MONO_ADVANCE))
  const advance = fontSize * MONO_ADVANCE
  const width = length * advance
  const start = CENTER - width / 2
  return { fontSize, width, start, split: start + props.user.length * advance, end: start + width }
})
const userMiddle = computed<number>(() => (address.value.start + address.value.split) / 2)
const domainMiddle = computed<number>(() => (address.value.split + address.value.end) / 2)
const userBracket = computed<string>(() => bracket(address.value.start + BRACKET_INSET, address.value.split - BRACKET_INSET, userMiddle.value))
const domainBracket = computed<string>(() => bracket(address.value.split + BRACKET_INSET, address.value.end - BRACKET_INSET, domainMiddle.value))
const appLinks = computed<{ from: Point, to: Point, color: string }[]>(() =>
  APPS.flatMap((from, index) => APPS.slice(index + 1).map(to => ({ from, to, color: from.color }))),
)

function bracket(from: number, to: number, middle: number): string {
  return `M${from} 76 V84 H${to} V76 M${middle} 84 V94`
}
</script>

<template>
  <div class="bd-fedi-cards" role="region" :aria-label="t('home.fediverse.cardsLabel')" tabindex="0">
    <article class="bd-fedi-explain">
      <div class="bd-fedi-art">
        <svg viewBox="0 0 320 128" aria-hidden="true" focusable="false">
          <g font-family="JetBrains Mono, monospace" font-size="10" letter-spacing=".08em" text-anchor="middle" fill="var(--ink-muted)">
            <text x="44" y="122">{{ t('home.fediverse.cards.mail.yours').toUpperCase() }}</text>
            <text x="276" y="122">{{ t('home.fediverse.cards.mail.other').toUpperCase() }}</text>
          </g>
          <g v-for="offset in [0, 232]" :key="offset" :transform="`translate(${offset} 0)`">
            <rect x="8" y="34" width="72" height="70" fill="var(--surface)" stroke="var(--line-strong)" />
            <g v-for="row in SERVER_ROWS" :key="row">
              <rect x="16" :y="row" width="56" height="12" fill="none" stroke="var(--line)" />
              <circle cx="24" :cy="row + 6" r="2" fill="var(--link)" />
              <path :d="`M32 ${row + 6} H64`" stroke="var(--ink-muted)" stroke-width="1" />
            </g>
          </g>
          <path class="bd-flight-route" d="M84 46 Q160 -4 236 46" fill="none" stroke="var(--link)" stroke-width="1.3" />
          <path d="M152 18 Q156 12 160 17 Q164 12 168 18" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round" />
          <rect x="149" y="24" width="22" height="15" fill="var(--surface-raised)" stroke="var(--ink)" stroke-width="1.2" />
          <path d="M149 24 L160 33 L171 24" fill="none" stroke="var(--ink)" stroke-width="1.2" />
        </svg>
      </div>
      <h3 class="bd-fedi-card-title">{{ t('home.fediverse.cards.mail.title') }}</h3>
      <p class="bd-fedi-card-text">{{ t('home.fediverse.cards.mail.text') }}</p>
    </article>

    <article class="bd-fedi-explain">
      <div class="bd-fedi-art">
        <svg viewBox="0 0 320 128" aria-hidden="true" focusable="false">
          <g font-family="JetBrains Mono, monospace" text-anchor="middle">
            <text x="160" y="26" font-size="10" letter-spacing=".08em" fill="var(--ink-muted)">{{ t('home.fediverse.cards.address.caption').toUpperCase() }}</text>
            <text
              x="160"
              y="62"
              :font-size="address.fontSize"
              :textLength="address.width"
              lengthAdjust="spacingAndGlyphs"
              fill="var(--ink)"
            >{{ user }}<tspan fill="var(--link)">{{ domain }}</tspan></text>
            <text :x="userMiddle" y="110" font-size="10" letter-spacing=".08em" fill="var(--ink-muted)">{{ t('home.fediverse.cards.address.user').toUpperCase() }}</text>
            <text :x="domainMiddle" y="110" font-size="10" letter-spacing=".08em" fill="var(--link)">{{ t('home.fediverse.cards.address.server').toUpperCase() }}</text>
          </g>
          <path :d="userBracket" fill="none" stroke="var(--ink-muted)" stroke-width="1" />
          <path :d="domainBracket" fill="none" stroke="var(--link)" stroke-width="1" />
        </svg>
      </div>
      <h3 class="bd-fedi-card-title">{{ t('home.fediverse.cards.address.title') }}</h3>
      <p class="bd-fedi-card-text">{{ t('home.fediverse.cards.address.text', { user, server: domain.replace(/^@/, '') }) }}</p>
    </article>

    <article class="bd-fedi-explain">
      <div class="bd-fedi-art">
        <svg viewBox="0 0 320 128" aria-hidden="true" focusable="false">
          <path
            v-for="link in appLinks"
            :key="`${link.from.x}-${link.to.x}-${link.to.y}`"
            :d="`M${link.from.x} ${link.from.y} L${link.to.x} ${link.to.y}`"
            :stroke="link.color"
            stroke-opacity=".7"
            stroke-width="2"
          />
          <circle v-for="app in APPS" :key="app.name" :cx="app.x" :cy="app.y" r="8" :fill="app.color" />
          <g font-family="JetBrains Mono, monospace" font-size="11" letter-spacing=".08em" fill="var(--ink)">
            <g v-for="(app, index) in APPS" :key="app.name">
              <rect x="150" :y="19 + index * 20" width="8" height="8" :fill="app.color" />
              <text x="166" :y="27 + index * 20">{{ app.name }}</text>
            </g>
          </g>
        </svg>
      </div>
      <h3 class="bd-fedi-card-title">{{ t('home.fediverse.cards.apps.title') }}</h3>
      <p class="bd-fedi-card-text">{{ t('home.fediverse.cards.apps.text') }}</p>
    </article>
  </div>
</template>
