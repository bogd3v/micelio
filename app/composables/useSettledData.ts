import type { AsyncDataRequestStatus } from '#app'

/**
 * Returns the data of an async request, keeping the last settled value while a request is pending.
 *
 * @remarks
 * While `status` is `pending`, the result stays on the last value that was not pending, so a list does not empty during a refetch. Before the first settled value, the result is the value `data` held when the composable was called. Call it in setup, because it uses `watch` and `computed`.
 */
export function useSettledData<T>(data: Ref<T>, status: Ref<AsyncDataRequestStatus>): ComputedRef<T> {
  const last = shallowRef<T>(data.value)
  watch([data, status], ([value, state]) => {
    if (state !== 'pending') last.value = value
  })
  return computed<T>(() => (status.value === 'pending' ? last.value : data.value))
}
