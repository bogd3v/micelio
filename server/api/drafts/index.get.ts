import qs from 'qs'
import type { DraftListItem, DraftListResponse } from '~/interfaces'
import { isDraftState, sortDrafts } from '~/helpers/drafts'

export default defineEventHandler(async (event): Promise<DraftListResponse> => {
  preventCaching(event)
  const jwt = editorSession(event)
  const query = qs.stringify({ locale: draftLocale(event) }, { skipNulls: true })
  const response = await fetchAsEditor<{ data?: DraftListItem[] | null }>(event, jwt, '/api/articles/drafts', query)
  const data = sortDrafts((response.data ?? []).filter(draft => isDraftState(draft.state)))
  return { data, meta: { count: data.length } }
})
