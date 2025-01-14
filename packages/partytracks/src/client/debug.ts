import { tap } from "rxjs";

import { logger } from "./logging";

export function debugTap<T>(message: string) {
  return tap<T>({
    next: (...args) => logger.debug(message, ...args),
    complete: () => logger.debug("COMPLETED ", message)
  });
}
