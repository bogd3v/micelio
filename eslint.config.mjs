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
    // Response schemas are for server code and tests; a component importing zod would ship it to the browser
    files: ['app/{components,pages,composables,layouts,islands,plugins,middleware,helpers,interfaces}/**/*.{ts,vue}', 'themes/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['~/schemas', '~/schemas/*', '~~/app/schemas/*', '**/schemas', '**/schemas/*'],
          message: 'app/schemas/ holds response schemas for server code and tests only; components use the interfaces of app/interfaces (see the TSDoc of responseSchema).',
        }],
      }],
    },
  },
  {
    files: ['.claude/skills/**/scripts/*.mjs', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Every error of the server is a problem detail with a code (ADR 0015)
    files: ['server/**/*.ts'],
    ignores: ['server/utils/problem.ts', 'server/schemas/**'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.type=\'MemberExpression\'][callee.property.name=/^(then|catch|finally)$/]',
        message: 'No promise chains: use await with try/catch (AGENTS.md, Async code).',
      }, {
        selector: 'CallExpression[callee.name=\'createError\']',
        message: 'Throw problem(code, options) from server/utils/problem.ts instead of createError (ADR 0015).',
      }],
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
    files: ['**/*.ts'],
    ignores: ['**/*.d.ts', '.nuxt/**', '.output/**', 'test/**', 'e2e/**'],
    plugins: { tsdoc, jsdoc },
    rules: {
      'tsdoc/syntax': 'error',
      'jsdoc/require-jsdoc': ['error', {
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
    ignores: ['docs/**', '.claude/worktrees/**'],
  },
)
