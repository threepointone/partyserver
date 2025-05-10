import { scan, takeUntil, take, merge, EMPTY, switchAll } from "rxjs";
import type { Observable } from "rxjs";

/**
 * A custom RxJS operator that maps each source value to an inner observable,
 * keeping the previous inner observable alive until the new one emits its first value.
 *
 * This is similar to `switchMap`, but instead of immediately unsubscribing from
 * the previous inner observable when a new source value arrives, it allows the previous
 * observable to continue emitting until the first emission from the new observable.
 * At that point, the previous observable is forcefully unsubscribed and all subsequent
 * values come from the new one.
 *
 * This is useful for cases where you want to avoid "gaps" in emitted values when
 * switching between observables, such as switching video streams, data feeds, or UI states
 * that should only change once the replacement is "ready."
 *
 * @template T The type of values emitted by the source observable.
 * @template R The type of values emitted by the projected inner observables.
 *
 * @param {(value: T) => Observable<R>} project A function that maps each source value to an inner observable.
 *
 * @returns {(source$: Observable<T>) => Observable<R>} A function that returns an observable that mirrors the inner observable,
 * but delays unsubscription of the previous one until the new one emits at least once.
 *
 * @example
 * ```ts
 * a$.pipe(
 *   handoffMap(a => a ? b$ : c$)
 * ).subscribe(console.log);
 * ```
 *
 * @remarks
 * - The inner observables should ideally be hot or shared (e.g. via `share()`) to prevent multiple subscriptions
 *   from duplicating side effects or restarting emissions.
 * - If the inner observables are cold and cause side effects (e.g. HTTP requests), ensure that shared
 *   subscriptions are used to avoid triggering those effects multiple times.
 * - The returned observable will unsubscribe from the old inner observable as soon as the
 *   new one emits its first value — not before, not later.
 */
export function handoffMap<T, R>(
  project: (value: T) => Observable<R>
): (source$: Observable<T>) => Observable<R> {
  return (source$: Observable<T>) =>
    source$.pipe(
      scan<
        // Keep merging new inner observables with a graceful handoff
        T,
        Observable<R>
      >((prevInner$, newOuterValue) => {
        const newInner$ = project(newOuterValue);
        const prevUntilNewEmits$ = prevInner$.pipe(
          takeUntil(newInner$.pipe(take(1)))
        );
        return merge(prevUntilNewEmits$, newInner$);
      }, EMPTY),
      switchAll()
    );
}
