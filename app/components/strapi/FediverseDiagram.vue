<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <svg class="bd-fedi-diagram" width="400" height="220" viewBox="0 0 400 220" role="img" :aria-label="t('about.diagram.label')">
    <g font-family="JetBrains Mono, monospace" letter-spacing=".08em" text-anchor="middle">
      <rect x="0.5" y="80.5" width="120" height="60" fill="var(--surface-raised)" stroke="var(--line-strong)" />
      <text x="60" y="108" font-size="12" font-weight="500" fill="var(--ink)">{{ t('about.diagram.source') }}</text>
      <text x="60" y="126" font-size="10" fill="var(--link)">{{ t('about.diagram.engine') }}</text>
      <rect x="279.5" y="20.5" width="120" height="44" fill="var(--surface-raised)" stroke="var(--line-strong)" />
      <text x="340" y="47" font-size="11" fill="var(--ink)">{{ t('about.diagram.mastodon') }}</text>
      <rect x="279.5" y="88.5" width="120" height="44" fill="var(--surface-raised)" stroke="var(--line-strong)" />
      <text x="340" y="115" font-size="11" fill="var(--ink)">{{ t('about.diagram.instance') }}</text>
      <rect x="279.5" y="156.5" width="120" height="44" fill="var(--surface-raised)" stroke="var(--line-strong)" />
      <text x="340" y="183" font-size="11" fill="var(--ink)">{{ t('about.diagram.others') }}</text>
    </g>
    <g fill="none" stroke="var(--link)" stroke-width="1.4">
      <path d="M121 100 Q200 60 278 42" />
      <path d="M121 110 L278 110" />
      <path d="M121 120 Q200 160 278 178" />
    </g>
    <g fill="none" stroke="var(--link)" stroke-opacity=".6" stroke-width="1.2">
      <path class="bd-flight-route" d="M278 50 Q200 76 121 104" />
      <path class="bd-flight-route" d="M278 172 Q200 144 121 116" />
    </g>
  </svg>
</template>
