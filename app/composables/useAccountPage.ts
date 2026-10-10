import { pageTitle } from '~/helpers/site'

interface UseAccountPage {
  errorMessage: (err: unknown) => string
}

/**
 * Sets the title of an account page, keeps the page out of search engines and returns the auth error message function.
 *
 * @remarks
 * Call it in setup, because it registers `useSeoMeta` and reads `useSite`. The title is reactive: it follows `title` when it is a ref or a getter. The page always gets `robots` set to `noindex, nofollow`.
 */
export function useAccountPage(title: MaybeRefOrGetter<string>): UseAccountPage {
  const errorMessage = useAuthErrorMessage()
  const site = useSite()

  useSeoMeta({
    title: () => pageTitle(toValue(title), site.value.name),
    robots: 'noindex, nofollow',
  })

  return { errorMessage }
}
