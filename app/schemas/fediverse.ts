import { z } from 'zod'
import type { FediverseStats } from '~/interfaces/fediverse'
import { responseSchema } from './response'

/** The likes and boosts of one article (`GET /api/fediverse/stats/{documentId}`). */
export const fediverseStatsSchema = responseSchema<FediverseStats>()(
  z.strictObject({ likes: z.int().min(0), boosts: z.int().min(0) }).meta({ id: 'FediverseStats', description: 'The fediverse interactions with one article.' }),
)

/** The stats of several articles by document id; an article with no activity is absent (`GET /api/fediverse/stats`). */
export const fediverseStatsByIdSchema = responseSchema<Record<string, FediverseStats>>()(
  z.record(z.string(), fediverseStatsSchema),
)
