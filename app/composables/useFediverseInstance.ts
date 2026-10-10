import type { Ref } from 'vue'
import type { InstanceError } from '~/interfaces'
import { followUrl, normalizeInstance } from '~/helpers/fediverse'

interface FediverseInstance {
  instance: Ref<string>
  error: Ref<InstanceError | null>
  preview: Readonly<Ref<string | undefined>>
  open: () => void
}

/**
 * Holds the Fediverse instance field of a remote-interaction form and opens the instance's `authorize_interaction` page for the target.
 *
 * @remarks
 * `preview` is the normalized domain of the typed value, or `undefined` when it does not parse. `open` normalizes the value and sets `error` to the reason it is invalid. A valid domain is written back to `instance` and opened in a new tab with `noopener` and `noreferrer`. Typing clears `error`. Call it in setup, because it uses `watch`.
 *
 * @param target - Returns the actor or article URL to open on the instance; it is read on each `open`.
 */
export function useFediverseInstance(target: () => string): FediverseInstance {
  const instance = ref('')
  const error = ref<InstanceError | null>(null)

  const preview = computed<string | undefined>(() => normalizeInstance(instance.value).domain)

  function open(): void {
    const result = normalizeInstance(instance.value)
    error.value = result.error ?? null
    if (!result.domain) return
    instance.value = result.domain
    window.open(followUrl(result.domain, target()), '_blank', 'noopener,noreferrer')
  }

  watch(instance, () => {
    error.value = null
  })

  return { instance, error, preview, open }
}
