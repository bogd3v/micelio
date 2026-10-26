import { PREVIEW_DRAFT_CONTEXT_KEY } from '~/constants/preview'

// Hands the draft the weight route redeemed down its sub-requests (ADR 0019, amendment of 2026-10-25). `event.$fetch` gives the child the parent's context as
// `event.node.req.__unenv__`, an internal of Nitro 2 that `test/integration/api.test.ts` pins; a request from the network has none, so no header, cookie,
// query or body can set the key. Only that one key is copied, and only when it is an object.
export default defineEventHandler((event) => {
  const inherited = (event.node.req as { __unenv__?: Record<string, unknown> }).__unenv__?.[PREVIEW_DRAFT_CONTEXT_KEY]
  if (inherited && typeof inherited === 'object') event.context[PREVIEW_DRAFT_CONTEXT_KEY] = inherited
})
