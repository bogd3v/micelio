// Constants shared by the islands, their loader, the Worker, the helpers and the build (ADR 0006, ADR 0004).
/** The custom element of a Mermaid diagram. */
export const MERMAID_ELEMENT = 'micelio-mermaid'

/** Largest model the build copies and the island fetches. */
export const MODEL_MAX_BYTES = 20 * 1024 * 1024
