<template>
  <div>
    <svg width="120" height="60" viewBox="0 0 120 60" aria-hidden="true" focusable="false">
      <path d="M0 44 Q60 58 120 44" fill="none" stroke="var(--line-strong)" stroke-width="1" />
      <g transform="translate(60 51)">
        <g class="bogota-perch">
          <path d="M-8 -4 Q-9 -11 -2 -12 Q1 -17 6 -15 L7 -14 Q8 -6 2 -2 L-3 -1 L-11 4 Z" fill="var(--ink-muted)" />
          <path d="M6 -15 L12 -13.5 L7 -12.5 Z" fill="var(--empty-accent, var(--accent))" />
        </g>
      </g>
    </svg>
    <slot />
  </div>
</template>
