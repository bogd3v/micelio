/**
 * Takes a query parameter out of the address bar once the page is on screen, so a one-use secret in an emailed link does not stay in the URL.
 *
 * @remarks
 * The page must read the value in setup (`route.query` is empty afterwards). The address bar, the history entry and the `Referer` of the requests that follow then carry the page without the secret. Call it in setup: it registers an `onMounted` hook and replaces the route without adding a history entry.
 */
export function useForgetQueryParam(name: string): void {
  const route = useRoute()
  const router = useRouter()
  onMounted(async () => {
    // A page that renders only in the browser can mount before the first navigation has finished
    await router.isReady()
    if (route.query[name] === undefined) return
    const query = Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== name))
    router.replace({ path: route.path, query, hash: route.hash })
  })
}
