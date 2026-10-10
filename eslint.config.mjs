import withNuxt from './.nuxt/eslint.config.mjs'
import jsdoc from 'eslint-plugin-jsdoc'
import tsdoc from 'eslint-plugin-tsdoc'

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
    // TSDoc syntax and a doc comment on every export (standard, section 4). Scoped to .ts: tsdoc cannot parse .vue.
    // `require-jsdoc` warns until a folder is complete; each folder's PR raises it to an error (#425).
    files: ['**/*.ts'],
    ignores: ['**/*.d.ts', '.nuxt/**', '.output/**', 'test/**', 'e2e/**'],
    plugins: { tsdoc, jsdoc },
    rules: {
      'tsdoc/syntax': 'error',
      'jsdoc/require-jsdoc': ['warn', {
        publicOnly: true,
        require: { FunctionDeclaration: true, ClassDeclaration: true },
        contexts: [
          'ExportNamedDeclaration > TSInterfaceDeclaration',
          'ExportNamedDeclaration > TSTypeAliasDeclaration',
          'ExportNamedDeclaration > TSEnumDeclaration',
          'ExportNamedDeclaration > VariableDeclaration',
        ],
      }],
    },
  },
  {
    // Folders whose exports are all documented: a missing comment fails the lint (#425).
    files: ['app/interfaces/**/*.ts', 'app/constants/categories.ts', 'app/composables/useSite.ts', 'app/helpers/**/*.ts'],
    rules: { 'jsdoc/require-jsdoc': 'error' },
  },
  {
    ignores: ['docs/**', '.claude/worktrees/**'],
  },
)
