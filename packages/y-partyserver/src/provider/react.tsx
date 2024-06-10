import { useEffect, useState } from "react";

import YPartyKitProvider from "./index";

import type * as Y from "yjs";

type UseYPartyKitProviderOptions = {
  host?: string | undefined;
  room: string;
  party?: string;
  doc?: Y.Doc;
  options?: ConstructorParameters<typeof YPartyKitProvider>[3];
};

export default function useYProvider(
  yProviderOptions: UseYPartyKitProviderOptions
) {
  const { host, room, party, doc, options } = yProviderOptions;
  const [provider] = useState<YPartyKitProvider>(
    () =>
      new YPartyKitProvider(
        host ||
          (typeof window !== "undefined"
            ? window.location.host
            : "dummy-domain.com"),
        room,
        doc,
        {
          connect: false,
          party,
          ...options
        }
      )
  );

  useEffect(() => {
    void provider.connect();
    return () => provider.disconnect();
  }, [provider]);
  return provider;
}
