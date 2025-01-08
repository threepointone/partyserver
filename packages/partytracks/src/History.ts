export class History<T> extends EventTarget {
  entries: T[] = [];
  private limit: number;

  constructor(limit: number = Number.POSITIVE_INFINITY) {
    super();
    this.limit = Math.max(1, limit); // Ensure the limit is at least 1
  }

  addEventListener(
    type: "logentry",
    callback:
      | { handleEvent: (event: Event & { entry: T }) => void }
      | ((event: Event & { entry: T }) => void)
      | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void {
    super.addEventListener(type, callback, options);
    return;
  }

  removeEventListener(
    type: "logentry",
    callback:
      | { handleEvent: (event: Event & { entry: T }) => void }
      | ((event: Event & { entry: T }) => void)
      | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void {
    super.removeEventListener(type, callback, options);
    return;
  }

  log(entry: T) {
    if (this.entries.length >= this.limit) {
      this.entries.shift(); // Remove the oldest entry
    }
    this.entries.push(entry);
    this.dispatchEvent(new CustomEvent("logentry"));
  }
}
