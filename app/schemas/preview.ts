import { z } from 'zod'
import type { WeightBlock, WeightReport, WeightReportResponse } from '~/interfaces/preview'
import { responseSchema } from './response'

const kilobytes = z.number().min(0)

/** The share of one block in a weight report. */
export const weightBlockSchema = responseSchema<WeightBlock>()(
  z.strictObject({
    id: z.string().meta({ description: 'The block\'s catalogue id: its component name without the namespace.' }),
    kb: kilobytes.meta({ description: 'What the page weighs more with the block than without it, in KB as sent.' }),
    onDemandKb: kilobytes.meta({ description: 'The script its island loads only once it is used; 0 for a block that has none.' }),
  }).meta({ id: 'WeightBlock', description: 'The share of one block of a draft in its weight.' }),
)

/** The weight report of a draft in one mode. */
export const weightReportSchema = responseSchema<WeightReport>()(
  z.strictObject({
    mode: z.enum(['dynamic', 'static']),
    htmlKb: kilobytes,
    cssKb: kilobytes.meta({ description: 'The stylesheets the page declares.' }),
    jsKb: kilobytes.meta({ description: 'The scripts the page declares, `modulepreload` links included.' }),
    fontKb: kilobytes.meta({ description: 'The fonts the page preloads and its stylesheets reference.' }),
    imagesKb: kilobytes.meta({ description: 'The images the page loads without scrolling: those not marked `loading="lazy"`.' }),
    totalKb: kilobytes.meta({ description: 'HTML, CSS, JS, fonts and images; never `onDemandKb`.' }),
    onDemandKb: kilobytes.meta({ description: 'The script the islands of the page load only once one is used, apart from `totalKb`.' }),
    blocks: z.array(weightBlockSchema).meta({ description: 'One entry per block of the draft\'s zone, in order.' }),
  }).meta({ id: 'WeightReport', description: 'The weight of a draft as a visitor would download it, measured on the rendered page.' }),
)

/** The weight route (`GET /api/preview/{uid}/{documentId}/weight`). */
export const weightReportResponseSchema = responseSchema<WeightReportResponse>()(
  z.strictObject({ data: weightReportSchema }).meta({ id: 'WeightReportResponse', description: 'The weight report of a draft.' }),
)
