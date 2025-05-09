import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  of,
  shareReplay
} from "rxjs";
import type { Observable } from "rxjs";
import { permission$ } from "./permission$";

function deviceMatch(deviceA: MediaDeviceInfo, deviceB: MediaDeviceInfo) {
  return deviceA.kind === deviceB.kind && deviceA.label === deviceB.label;
}

interface DeviceManager {
  permissionState$: Observable<PermissionState>;
  devices$: Observable<MediaDeviceInfo[]>;
  activeDevice$: Observable<MediaDeviceInfo>;
  setPreferredDevice: (device: MediaDeviceInfo) => void;
  deprioritizeDevice: (device: MediaDeviceInfo) => void;
  devicePriority$: Observable<MediaDeviceInfo[]>;
}

export const createDeviceManager = (options: {
  devices$: Observable<MediaDeviceInfo[]>;
  localStorageNamespace: string;
  activeDeviceId$: Observable<string>;
  permissionName: "camera" | "microphone";
}): DeviceManager => {
  const preferredDevice$ = localStorageValue$<MediaDeviceInfo>(
    `${options.localStorageNamespace}-preferred-device`
  );

  const deprioritizedDevices = localStorageValue$<MediaDeviceInfo[]>(
    `${options.localStorageNamespace}-deprioritized-devices`,
    []
  );

  const devicePriority$ = combineLatest([
    preferredDevice$.value$,
    deprioritizedDevices.value$,
    options.devices$
  ]).pipe(
    // sort first by deprioritizedDevices,
    // then bring preferredDevice to the front
    map(([preferredDevice, deprioritizedDevices, devices]) =>
      devices
        .toSorted((a, b) => {
          const deprioritizeA = deprioritizedDevices?.some((item) =>
            deviceMatch(a, item)
          );
          const deprioritizeB = deprioritizedDevices?.some((item) =>
            deviceMatch(b, item)
          );

          if (b.label.toLowerCase().includes("virtual")) {
            return -1;
          }

          if (b.label.toLowerCase().includes("iphone microphone")) {
            return -1;
          }

          if (deprioritizeA && !deprioritizeB) {
            // move A down the list
            return 1;
          } else if (!deprioritizeA && deprioritizeB) {
            // move B down the list
            return -1;
          }

          // leave as is
          return 0;
        })
        .toSorted((a, b) => {
          if (preferredDevice && deviceMatch(preferredDevice, a)) {
            return -1;
          } else if (preferredDevice && deviceMatch(preferredDevice, b)) {
            return 1;
          } else {
            return 0;
          }
        })
    )
  );

  const activeDevice$ = combineLatest([
    options.activeDeviceId$,
    devicePriority$
  ]).pipe(
    map(
      ([deviceId, devices]) =>
        devices.find((d) => d.deviceId === deviceId) ?? devices[0]
    )
  );

  return {
    permissionState$: permission$(options.permissionName),
    devices$: options.devices$,
    deprioritizeDevice: (device) =>
      deprioritizedDevices.setValue((deprioritizedDevices) =>
        (deprioritizedDevices ?? [])
          .filter((d) => deviceMatch(d, device))
          .concat(device)
      ),
    devicePriority$,
    activeDevice$,
    setPreferredDevice: (device) => {
      deprioritizedDevices.setValue(
        (devices) => devices?.filter((d) => deviceMatch(d, device)) ?? []
      );
      preferredDevice$.setValue(() => device);
    }
  };
};

const isLocalStorageEnabled = (() => {
  try {
    const key = "__partytracks-localstorage-test__";
    localStorage.setItem(key, "");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
})();

function localStorageValue$<T>(key: string, defaultValue?: T) {
  if (!isLocalStorageEnabled) {
    const value$ = new BehaviorSubject(defaultValue);
    return {
      value$,
      setValue: (update: (value: T | undefined) => T) =>
        value$.next(update(value$.value))
    };
  }

  const item = getLocalStorage(key);
  if (item === undefined && defaultValue !== undefined) {
    setLocalStorage(key, () => defaultValue);
  }
  return {
    setValue: (update: (value: T | undefined) => T) =>
      setLocalStorage(key, update),
    value$: merge(
      of(getLocalStorage<T>(key)),
      fromEvent(window, "storage").pipe(
        map(() => localStorage.getItem(key)),
        distinctUntilChanged(),
        map((value) => (value === null ? undefined : (JSON.parse(value) as T)))
      )
    ).pipe(
      shareReplay({
        refCount: true,
        bufferSize: 1
      })
    )
  };
}

function setLocalStorage<T>(key: string, update: (oldValue?: T) => T) {
  if (isLocalStorageEnabled) {
    localStorage.setItem(key, JSON.stringify(update(getLocalStorage(key))));
    window.dispatchEvent(new Event("storage"));
  }
}

function getLocalStorage<T>(key: string) {
  if (isLocalStorageEnabled) {
    const existingValue = localStorage.getItem(key);
    if (existingValue) {
      return JSON.parse(existingValue) as T;
    }
  }
}
