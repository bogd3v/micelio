import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    files: ['**/*.ts', '**/*.vue', '**/*.js', '**/*.mjs'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
    },
  },
  {
    files: ['.claude/skills/**/scripts/*.mjs', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['docs/**', '.claude/worktrees/**'],
  },
)
