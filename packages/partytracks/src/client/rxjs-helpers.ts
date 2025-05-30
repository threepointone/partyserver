import type { Observable } from "rxjs";
import { timer } from "rxjs";
import { retry } from "rxjs/operators";

interface BackoffConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  resetOnSuccess?: boolean;
}

const configDefaults: Required<BackoffConfig> = {
  maxRetries: Number.POSITIVE_INFINITY,
  initialDelay: 250,
  maxDelay: 10000,
  backoffFactor: 2,
  resetOnSuccess: true
};

export function retryWithBackoff<T>(config: BackoffConfig = {}) {
  const mergedConfig = {
    ...configDefaults,
    ...config
  };
  const {
    maxRetries = Number.POSITIVE_INFINITY,
    initialDelay = 250,
    maxDelay = 10000,
    backoffFactor = 2,
    resetOnSuccess = true
  } = mergedConfig;

  return (source: Observable<T>): Observable<T> =>
    source.pipe(
      retry({
        count: maxRetries,
        resetOnSuccess,
        delay: (_err, count) => {
          // Calculate delay with exponential backoff
          const delay = Math.min(
            initialDelay * backoffFactor ** (count - 1),
            maxDelay
          );

          // Return an observable that emits after the calculated delay
          return timer(delay);
        }
      })
    );
}
