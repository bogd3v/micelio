import { isIslandScript, previewMode } from '~/helpers/preview'

/**
 * Leaves every island of a draft route on its static alternative when the route is asked for `mode=static` (ADR 0019, decision 8).
 *
 * @remarks
 * It drops the `<script>` tags that declare or load an island from the head, on the server and in the browser, so the page keeps its Vue hydration and its preview messages but runs no island. Called only by the draft pages: the shared island composables, and so the entry chunk of every public page, are untouched. Without `mode=static` it does nothing.
 */
export function useStaticPreview(): void {
  if (previewMode(useRoute().query.mode) !== 'static') return
  injectHead()?.hooks?.hook('tags:resolve', (context) => {
    context.tags = context.tags.filter(tag => !isIslandScript(tag))
  })
}
