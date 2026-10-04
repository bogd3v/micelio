import { pageTitle } from '~/helpers/site'

interface UseAccountPage {
  errorMessage: (err: unknown) => string
}

export function useAccountPage(title: MaybeRefOrGetter<string>): UseAccountPage {
  const errorMessage = useAuthErrorMessage()
  const site = useSite()

  useSeoMeta({
    title: () => pageTitle(toValue(title), site.value.name),
    robots: 'noindex, nofollow',
  })

  return { errorMessage }
}
