import { z } from 'zod'

/** What the CMS answers to `GET /api/micelio/redirects` (docs/api.md of the plugin): the rows as they are, checked for shape only. A row that is not a path of the site is dropped later, with a warning. */
export const redirectsResponseSchema = z.object({
  data: z.array(z.object({
    from: z.string(),
    to: z.string(),
    locale: z.string().nullable(),
  })),
})
