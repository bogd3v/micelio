// Sustainable Web Design (SWD) estimate of the CO2e of one page view, from the bytes the page transfers.
// Model: Sustainable Web Design v4, https://sustainablewebdesign.org/estimating-digital-emissions/ (checked 2026-10-19).
// The v4 page publishes no visitor shares; the new/returning/cache shares below are the SWD v3 and CO2.js ones.
// Pure and deterministic: no network, no clock. Reported next to the weight, never budgeted (docs/performance.md).

/** Name and version of the model implemented here */
export const SWD_MODEL = 'Sustainable Web Design v4'

/** Bytes in a gigabyte (SWD counts decimal gigabytes) */
const BYTES_PER_GB = 1e9

/** Operational energy per GB of data, in kWh, by segment of the system */
const OPERATIONAL_KWH_PER_GB = Object.freeze({ datacenter: 0.055, network: 0.059, device: 0.080 })

/** Embodied (manufacturing) energy per GB of data, in kWh, by segment of the system */
const EMBODIED_KWH_PER_GB = Object.freeze({ datacenter: 0.012, network: 0.013, device: 0.081 })

/** Global average grid carbon intensity, in grams of CO2e per kWh, applied to every segment (no per-site green hosting credit) */
const GRID_GRAMS_PER_KWH = 494

// SWD v4 names the visitor variables (New Visitor Ratio, Return Visitor Ratio, Data Cache Ratio) but publishes no
// defaults; the three shares below are the SWD v3 / CO2.js ones. Gigabytes are decimal (1e9), as CO2.js does.

/** Share of visits that load the page cold (an empty cache) */
const NEW_VISITOR_SHARE = 0.75

/** Share of returning visitors, whose browser cache serves most of the page */
const RETURNING_VISITOR_SHARE = 0.25

/** Share of the page a returning visitor downloads again */
const RETURNING_DATA_SHARE = 0.02

/**
 * Grams of CO2e of one cold page load of `bytes` transferred bytes.
 *
 * @param bytes - Bytes sent over the network, compressed as sent; negative or non-finite values count as 0.
 * @returns Grams of CO2e, unrounded.
 */
export function swdGramsPerLoad(bytes) {
  const gigabytes = Number.isFinite(bytes) && bytes > 0 ? bytes / BYTES_PER_GB : 0
  const kwhPerGb = Object.values(OPERATIONAL_KWH_PER_GB).reduce((sum, kwh) => sum + kwh, 0)
    + Object.values(EMBODIED_KWH_PER_GB).reduce((sum, kwh) => sum + kwh, 0)
  return gigabytes * kwhPerGb * GRID_GRAMS_PER_KWH
}

/**
 * Grams of CO2e of one page view, averaging new visitors (cold cache) and returning visitors (cache hit, 2 % of the bytes; 0.75 + 0.25 x 0.02 = 0.755 of a cold load).
 *
 * @remarks
 * An estimate for comparing runs and themes, not an absolute figure.
 *
 * @param bytes - Bytes sent over the network for a cold load.
 * @returns Grams of CO2e, unrounded.
 */
export function swdGramsPerView(bytes) {
  return swdGramsPerLoad(bytes) * (NEW_VISITOR_SHARE + RETURNING_VISITOR_SHARE * RETURNING_DATA_SHARE)
}

/**
 * Milligrams of CO2e of one page view, rounded to 0.01 mg for reports.
 *
 * @param bytes - Bytes sent over the network for a cold load.
 * @returns Milligrams of CO2e.
 */
export function swdMilligramsPerView(bytes) {
  return Math.round(swdGramsPerView(bytes) * 1e5) / 100
}
