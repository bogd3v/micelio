import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findProblems } from '../scripts/check-placement.mjs'

const roots: string[] = []

/** Builds a throwaway project with the given files and returns its placement problems. */
function problemsOf(files: Record<string, string>): string[] {
  const root = mkdtempSync(join(tmpdir(), 'placement-'))
  roots.push(root)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return findProblems(root)
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('check-placement', () => {
  it('reports a constant imported by two files', () => {
    const problems = problemsOf({
      'app/helpers/limits.ts': 'export const MAX = 3\n',
      'app/components/A.vue': '<script setup lang="ts">\nimport { MAX } from \'~/helpers/limits\'\n</script>\n',
      'server/utils/b.ts': 'import { MAX } from \'../../app/helpers/limits\'\n',
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('constant MAX is used by 2 files')
  })

  it('reports a type imported by two files, with import type and aliases', () => {
    const problems = problemsOf({
      'app/helpers/shape.ts': 'export interface Shape { id: string }\n',
      'app/helpers/a.ts': 'import type { Shape as S } from \'./shape\'\n',
      'app/helpers/b.ts': 'import { type Shape } from \'./shape\'\n',
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('type Shape is used by 2 files')
  })

  it('accepts a declaration imported by one file, or by none', () => {
    expect(problemsOf({
      'app/helpers/limits.ts': 'export const MAX = 3\nexport const UNUSED = 1\n',
      'app/helpers/a.ts': 'import { MAX } from \'./limits\'\n',
    })).toEqual([])
  })

  it('accepts declarations in the shared places however many files import them', () => {
    expect(problemsOf({
      'app/constants/limits.ts': 'export const MAX = 3\n',
      'modules/theme/types.ts': 'export interface Ctx { id: string }\n',
      'app/helpers/a.ts': 'import { MAX } from \'~/constants/limits\'\nimport type { Ctx } from \'../../modules/theme/types\'\n',
      'app/helpers/b.ts': 'import { MAX } from \'~/constants/limits\'\nimport type { Ctx } from \'../../modules/theme/types\'\n',
    })).toEqual([])
  })

  it('does not count a re-export as an importer', () => {
    expect(problemsOf({
      'app/helpers/limits.ts': 'export const MAX = 3\n',
      'app/helpers/reexport.ts': 'export { MAX } from \'./limits\'\n',
      'app/helpers/a.ts': 'import { MAX } from \'./limits\'\n',
    })).toEqual([])
  })

  it('reports logic and runtime imports in a shared file', () => {
    const problems = problemsOf({
      'app/constants/bad.ts': 'import { ref } from \'vue\'\nexport function make() { return ref(1) }\n',
    })
    expect(problems).toHaveLength(2)
    expect(problems.join('\n')).toContain('runtime import of vue')
    expect(problems.join('\n')).toContain('holds a function or class')
  })

  it('counts Nitro auto-import users of server/utils', () => {
    const problems = problemsOf({
      'server/utils/limits.ts': 'export const MAX = 3\n',
      'server/api/a.get.ts': 'export default () => MAX\n',
      'server/routes/b.get.ts': 'export default () => `${MAX}`\n',
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('constant MAX is used by 2 files')
  })

  it('counts Nuxt auto-import users of app/composables and app/utils, only inside app/', () => {
    const problems = problemsOf({
      'app/composables/useLimits.ts': 'export const MAX = 3\n',
      'app/utils/other.ts': 'export const MIN = 1\n',
      'app/components/A.vue': '<script setup lang="ts">\nconst x = MAX + MIN\n</script>\n',
      'app/pages/b.vue': '<script setup lang="ts">\nconst y = MAX + MIN\n</script>\n',
      'server/api/c.get.ts': 'export default () => MAX\n',
      'server/api/d.get.ts': 'export default () => MIN\n',
    })
    expect(problems).toHaveLength(2)
    expect(problems.join('\n')).toContain('constant MAX is used by 2 files')
    expect(problems.join('\n')).not.toContain('server/api')
  })

  it('ignores a name mentioned only in a comment or a string', () => {
    expect(problemsOf({
      'server/utils/limits.ts': 'export const MAX = 3\n',
      'server/api/a.get.ts': '// MAX is documented here\n/* MAX again */\nexport default () => \'MAX\'\n',
      'server/api/b.get.ts': 'export default () => MAX\n',
    })).toEqual([])
  })

  it('does not count an explicit importer twice', () => {
    expect(problemsOf({
      'server/utils/limits.ts': 'export const MAX = 3\n',
      'server/api/a.get.ts': 'import { MAX } from \'../utils/limits\'\nexport default () => MAX\n',
    })).toEqual([])
  })

  it('counts an explicit importer and an auto-import user together', () => {
    expect(problemsOf({
      'server/utils/limits.ts': 'export const MAX = 3\n',
      'server/api/a.get.ts': 'import { MAX } from \'../utils/limits\'\nexport default () => MAX\n',
      'server/api/b.get.ts': 'export default () => MAX\n',
    })).toHaveLength(1)
  })

  it('does not count a file that shadows the name, imports it from elsewhere, or uses it as a key', () => {
    expect(problemsOf({
      'server/utils/limits.ts': 'export const MAX = 3\n',
      'server/api/a.get.ts': 'const MAX = 5\nexport default () => MAX\n',
      'server/api/b.get.ts': 'import { MAX } from \'../other\'\nexport default () => MAX\n',
      'server/other.ts': 'export const MAX = 9\n',
      'server/api/c.get.ts': 'export default () => ({ MAX: 1 })\n',
      'server/api/d.get.ts': 'const { MAX } = useThing()\nexport default () => MAX\n',
    })).toEqual([])
  })

  it('still counts a ternary branch and a #imports import as uses', () => {
    expect(problemsOf({
      'server/utils/limits.ts': 'export const MAX = 3\n',
      'server/api/a.get.ts': 'export default (x: boolean) => (x ? MAX : 0)\n',
      'server/api/b.get.ts': 'import { MAX } from \'#imports\'\nexport default () => MAX\n',
    })).toHaveLength(1)
  })

  it('scans bound attributes of a .vue template', () => {
    const problems = problemsOf({
      'app/composables/useLimits.ts': 'export const MAX = 3\n',
      'app/components/A.vue': '<template>\n  <p :title="MAX" @click="go(MAX)">x</p>\n</template>\n',
      'app/components/B.vue': '<template>\n  <p title="MAX">{{ \'MAX\' }}</p>\n</template>\n',
      'app/pages/c.vue': '<template>\n  <p v-if="MAX > 1">x</p>\n</template>\n',
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('used by 2 files')
    expect(problems[0]).not.toContain('B.vue')
  })

  it('does not treat function-valued exports as constants', () => {
    expect(problemsOf({
      'server/utils/load.ts': 'export const loadPage = defineCachedFunction(fetchPage, {})\nexport const run = async () => 1\nexport const make = (a: number) => a\nexport const fn = function () {}\n',
      'server/api/a.get.ts': 'export default () => [loadPage, run, make, fn]\n',
      'server/api/b.get.ts': 'export default () => [loadPage, run, make, fn]\n',
    })).toEqual([])
  })

  it('does not count a type of server/utils as auto-imported', () => {
    expect(problemsOf({
      'server/utils/shape.ts': 'export interface Shape { id: string }\n',
      'server/api/a.get.ts': 'export default (s: Shape) => s\n',
      'server/api/b.get.ts': 'export default (s: Shape) => s\n',
    })).toEqual([])
  })

  it('scans server/utils recursively but Nuxt folders only at the top level', () => {
    const problems = problemsOf({
      'server/utils/deep/limits.ts': 'export const MAX = 3\n',
      'app/composables/nested/deep.ts': 'export const MIN = 1\n',
      'server/api/a.get.ts': 'export default () => MAX\n',
      'server/api/b.get.ts': 'export default () => MAX\n',
      'app/pages/a.vue': '<script setup lang="ts">\nconst x = MIN\n</script>\n',
      'app/pages/b.vue': '<script setup lang="ts">\nconst x = MIN\n</script>\n',
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('constant MAX')
  })

  it('accepts roles.mjs as a shared file and holds it to declarations only', () => {
    expect(problemsOf({
      'modules/theme/roles.mjs': 'export const ROLES = [\'a\']\n',
      'modules/theme/a.ts': 'import { ROLES } from \'./roles.mjs\'\n',
      'modules/theme/b.ts': 'import { ROLES } from \'./roles.mjs\'\n',
    })).toEqual([])
    expect(problemsOf({
      'modules/theme/roles.mjs': 'import { x } from \'./x.mjs\'\nexport function f() { return x }\n',
    })).toHaveLength(2)
  })

  it('passes on the repository', () => {
    expect(findProblems()).toEqual([])
  })
})
