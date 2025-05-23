import {
  catchError,
  combineLatest,
  concat,
  defer,
  from,
  fromEvent,
  map,
  of,
  switchMap
} from "rxjs";
import type { Observable } from "rxjs";

export type SafePermissionState = PermissionState | "unknown";

export const permission$ = (
  name: "camera" | "microphone"
): Observable<SafePermissionState> => {
  return concat(
    defer(() =>
      from(navigator.permissions.query({ name }).then((ps) => ps.state))
    ),
    defer(() =>
      from(navigator.permissions.query({ name })).pipe(
        switchMap((permissionStatus) =>
          combineLatest([
            of(permissionStatus),
            fromEvent(permissionStatus, "change")
          ])
        ),
        map(([permissionStatus]) => permissionStatus.state)
      )
    )
  ).pipe(catchError(() => of("unknown" as const)));
};
