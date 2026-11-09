// The Sustainable Web Design estimate for the perf scripts. The calculation lives in app/helpers/carbon.ts, which the weight
// report of a draft shares (GET /api/preview/{uid}/{documentId}/weight; docs/performance.md, "Carbon estimate").
// Loaded with jiti, as measure.mjs loads app/helpers/weight.ts, so it runs on every Node the engines field allows.
import { createJiti } from 'jiti'

/** @type {typeof import('../../app/helpers/carbon')} */
const carbon = await createJiti(import.meta.url).import('../../app/helpers/carbon.ts')

export const { SWD_MODEL, swdGramsPerLoad, swdGramsPerView, swdMilligramsPerView } = carbon
