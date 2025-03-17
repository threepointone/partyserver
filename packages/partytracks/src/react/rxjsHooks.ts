import { useEffect, useRef, useState } from "react";
import { BehaviorSubject } from "rxjs";

import type { Observable } from "rxjs";

/**
 * Subscribes to an Observable and returns the latest emitted value,
 * and unsubscribes when unmounting. Uses useOnEmit under the hood.
 * Accepts an optional default value. If one is not provided, value
 * will be undefined until the Observable emits something else.
 *
 * NOTE: It's important that your Observable be stable, so be sure to
 * memoize it!
 */
export function useObservableAsValue<T>(
  observable: Observable<T>
): T | undefined;
export function useObservableAsValue<T>(
  observable: Observable<T>,
  defaultValue: T
): T;
export function useObservableAsValue<T>(
  observable: Observable<T>,
  defaultValue?: T
): T {
  const [state, setState] = useState(defaultValue);
  // biome-ignore lint/correctness/useExhaustiveDependencies: who cares, the world is ending
  useEffect(() => {
    setState(defaultValue);
  }, [observable]);
  useOnEmit(observable, setState);
  // @ts-expect-error: not sure how to satisfy the type checker here, but this is safe.
  return state;
}

/**
 * Subscribes to an Observable and runs the provided function every
 * time a value is emitted, and unsubscribes when unmounting.
 *
 * NOTE: It's important that your Observable be stable, so be sure to
 * memoize it!
 */
export function useOnEmit<T>(
  observable: Observable<T>,
  fn: (value: T) => void
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const subscription = observable.subscribe((v) => fnRef.current(v));
    return () => {
      subscription.unsubscribe();
    };
  }, [observable]);
}

/**
 * Turns a value into a stable Observable that will emit new
 * values when the value changes, and completes upon unmounting.
 */
export function useValueAsObservable<T>(value: T): Observable<T> {
  const ref = useRef(new BehaviorSubject(value));
  const observableRef = useRef(ref.current.asObservable());
  const previousValue = useRef<T>(undefined);
  if (previousValue.current !== value) {
    previousValue.current = value;
    // since subscribers might call a setState, we don't want to
    // do this in the render path.
    queueMicrotask(() => ref.current.next(value));
  }

  useEffect(() => {
    const { current } = ref;
    if (!current) return;
    return () => {
      current.complete();
    };
  }, []);

  return observableRef.current;
}
