import { useEffect, useState } from "react";

import YPartyServerProvider from "./index";

import type * as Y from "yjs";

type UseYPartyServerProviderOptions = {
  host?: string | undefined;
  room: string;
  party?: string;
  doc?: Y.Doc;
  prefix?: string;
  options?: ConstructorParameters<typeof YPartyServerProvider>[3];
};

export default function useYProvider(
  yProviderOptions: UseYPartyServerProviderOptions
) {
  const { host, room, party, doc, options, prefix } = yProviderOptions;
  const [provider] = useState<YPartyServerProvider>(
    () =>
      new YPartyServerProvider(
        host ||
          (typeof window !== "undefined"
            ? window.location.host
            : "dummy-domain.com"),
        room,
        doc,
        {
          connect: false,
          party,
          prefix,
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
