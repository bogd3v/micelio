import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    files: ['**/*.ts', '**/*.vue', '**/*.js', '**/*.mjs'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.type=\'MemberExpression\'][callee.property.name=/^(then|catch|finally)$/]',
        message: 'No promise chains: use await with try/catch (AGENTS.md, Async code).',
      }],
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
    // zod schemas have their own .catch()
    files: ['server/schemas/**'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    ignores: ['docs/**', '.claude/worktrees/**'],
  },
)
