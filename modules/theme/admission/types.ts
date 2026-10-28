import type { z } from 'zod'
import type { AdmissionReportSchema } from './report'

/** An admission report as `theme:admit report` writes it. */
export type AdmissionReport = z.infer<typeof AdmissionReportSchema>
