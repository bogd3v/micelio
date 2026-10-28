// What the publish steps of several files share (ADR 0008, decision 4; #312).

/** The only tier this workflow writes: it runs from a bogd3v repository (ADR 0008, decision 7). #404 adds the others. */
export const PUBLISH_TIER = 'official'

/** Artifact type of the admission report attached to a package as a referrer. */
export const REPORT_ARTIFACT_TYPE = 'application/vnd.micelio.theme.admission-report.v1+json'

/** The annotations of a package artifact's manifest. */
export const ANNOTATIONS = {
  contract: 'io.micelio.theme.contract',
  license: 'io.micelio.theme.license',
  tier: 'io.micelio.theme.tier',
  packageDigest: 'io.micelio.theme.package-digest',
  reportDigest: 'io.micelio.theme.report-digest',
} as const

/** Longest yank reason, in characters. */
export const MAX_REASON_LENGTH = 500
