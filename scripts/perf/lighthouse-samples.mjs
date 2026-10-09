// Reads Lighthouse results for measure.mjs. Pure: no browser, no network (docs/performance.md, "Lighthouse").

/**
 * The metrics of one Lighthouse result, or `null` when it came back empty.
 * An empty result has no score or a metric audit without value (Lighthouse could not paint or measure the page);
 * recording it would give `NaN` metrics and a performance score of 0 that looks like a budget breach.
 */
export function readSample(lhr) {
  const { audits, categories } = lhr
  const lcp = audits['largest-contentful-paint']?.numericValue
  const tbt = audits['total-blocking-time']?.numericValue
  const cls = audits['cumulative-layout-shift']?.numericValue
  const performance = categories.performance?.score
  const accessibility = categories.accessibility?.score
  if (![lcp, tbt, cls, performance, accessibility].every(value => typeof value === 'number' && Number.isFinite(value))) return null
  return {
    lcpMs: Math.round(lcp),
    tbtMs: Math.round(tbt),
    cls: Math.round(cls * 1000) / 1000,
    performance: Math.round(performance * 100),
    accessibility: Math.round(accessibility * 100),
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * The median of each metric across the samples.
 * @throws {Error} when there are no samples
 */
export function medianSample(samples) {
  if (!samples.length) throw new Error('no Lighthouse samples')
  return Object.fromEntries(Object.keys(samples[0]).map(key => [key, median(samples.map(sample => sample[key]))]))
}

/**
 * Collects `runs` good samples from `measureOnce`, retrying empty results up to `runs` extra times.
 * Returns `null` when no attempt gave data, so the caller reports it instead of comparing it with a budget.
 * @param {() => Promise<object>} measureOnce runs Lighthouse once and returns its `lhr`
 * @param {number} runs samples wanted
 */
export async function collectSamples(measureOnce, runs) {
  const samples = []
  for (let attempt = 0; attempt < runs * 2 && samples.length < runs; attempt++) {
    const sample = readSample(await measureOnce())
    if (sample) samples.push(sample)
  }
  return samples.length ? medianSample(samples) : null
}
