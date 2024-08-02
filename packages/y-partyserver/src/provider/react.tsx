import { useEffect, useState } from "react";

import YProvider from "./index";

import type * as Y from "yjs";

type UseYProviderOptions = {
  host?: string | undefined;
  room: string;
  party?: string;
  doc?: Y.Doc;
  prefix?: string;
  options?: ConstructorParameters<typeof YProvider>[3];
};

export default function useYProvider(yProviderOptions: UseYProviderOptions) {
  const { host, room, party, doc, options, prefix } = yProviderOptions;
  const [provider] = useState<YProvider>(
    () =>
      new YProvider(
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
