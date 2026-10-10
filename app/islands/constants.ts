// Constants of the scene island and of the code around it: helpers, the server's Markdown and `RichTextBlock` (ADR 0006, ADR 0004).
// Do not import this file from the loader, a Worker or a second island entry: a module that two entries share becomes a chunk of its own,
// one more request for each, and only the loader case fails the build (`sharedWithLoader`, modules/lib/islands-graph.ts). The mermaid island
// writes the element name as a literal for that reason.
/** The custom element of a Mermaid diagram. */
export const MERMAID_ELEMENT = 'micelio-mermaid'

/** Largest model the build copies and the island fetches. */
export const MODEL_MAX_BYTES = 20 * 1024 * 1024
